import {
  fetchNpmPackage,
} from "./registry";

import {
  normalizePackageVersion,
  type NormalizedDependency,
  type NormalizedPackageVersion,
} from "./normalize";

import {
  upsertMaintainers,
  createMaintainsEdges,
  type MaintainerVertex,
  type MaintainsEdge,
} from "../graph/query/maintainers";

import { resolveVersion } from "./resolver";

import {
  upsertPackages,
  upsertVersions,
  createPackageVersionEdges,
  type PackageVertex,
  type VersionVertex,
} from "../graph/query/packages";

import {
  createDependencyEdges,
  type DependencyEdge,
} from "../graph/query/dependencies";

export interface IngestOptions {
  packageName: string;
  version: string;
  maxDepth: number;
  concurrency?: number;
}

export interface IngestStats {
  packages: number;
  versions: number;
  dependencyEdges: number;
  packageVersionEdges: number;
  maintainers: number;
  maintainsEdges: number;
  processedNodes: number;
  skippedNodes: number;
  failedNodes: number;
  maxDepth: number;
}

interface PackageRef {
  packageName: string;
  version: string;
  depth: number;
}

interface ResolvedDependency {
  name: string;
  range: string;
  version: string;
  type: "runtime" | "optional" | "peer";
}

interface PackageVersionEdge {
  id: number;
  packageId: number;
  versionId: number;
}

/*
 * ============================================================
 * DETERMINISTIC IDS
 * ============================================================
 */

function stableNumericId(key: string): number {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) + 1;
}

export function packageId(
  packageName: string,
): number {
  return stableNumericId(
    `package:npm:${packageName}`,
  );
}

export function versionId(
  packageName: string,
  version: string,
): number {
  return stableNumericId(
    `version:npm:${packageName}@${version}`,
  );
}

function maintainerId(
  npmUsername: string,
): number {
  return stableNumericId(
    `maintainer:npm:${npmUsername}`,
  );
}

function packageVersionEdgeId(
  packageId: number,
  versionId: number,
): number {
  return stableNumericId(
    `has-version:${packageId}->${versionId}`,
  );
}

function maintainsEdgeId(
  maintainerId: number,
  packageId: number,
): number {
  return stableNumericId(
    `maintains:${maintainerId}->${packageId}`,
  );
}

function dependencyEdgeId(
  sourceKey: string,
  targetKey: string,
): number {
  return stableNumericId(
    `dependency:${sourceKey}->${targetKey}`,
  );
}

function versionKey(
  packageName: string,
  version: string,
): string {
  return `npm:${packageName}@${version}`;
}

/*
 * ============================================================
 * CONCURRENCY
 * ============================================================
 */

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);

  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = cursor++;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(
        items[index],
      );
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length,
  );

  await Promise.all(
    Array.from(
      {
        length: workerCount,
      },
      () => runWorker(),
    ),
  );

  return results;
}

/*
 * ============================================================
 * DEPENDENCY RESOLUTION
 * ============================================================
 */

async function resolveDependencies(
  dependencies: NormalizedDependency[],
  concurrency: number,
): Promise<ResolvedDependency[]> {
  return mapConcurrent(
    dependencies,
    concurrency,
    async (dependency) => {
      const version = await resolveVersion(
        dependency.name,
        dependency.range,
      );

      return {
        name: dependency.name,
        range: dependency.range,
        version,
        type: dependency.type,
      };
    },
  );
}

/*
 * ============================================================
 * FETCH + NORMALIZE
 * ============================================================
 */

async function fetchAndNormalize(
  ref: PackageRef,
): Promise<NormalizedPackageVersion> {
  const metadata = await fetchNpmPackage(
    ref.packageName,
  );

  const versionMetadata =
    metadata.versions[ref.version];

  if (!versionMetadata) {
    throw new Error(
      `${ref.packageName}@${ref.version} ` +
      `does not exist in the npm registry`,
    );
  }

  return normalizePackageVersion(
    versionMetadata,
  );
}

/*
 * ============================================================
 * INGEST
 * ============================================================
 */

export async function ingestPackage(
  options: IngestOptions,
): Promise<IngestStats> {
  const {
    packageName,
    version,
    maxDepth,
    concurrency = 5,
  } = options;

  if (maxDepth < 0) {
    throw new Error(
      "maxDepth must be >= 0",
    );
  }

  const stats: IngestStats = {
    packages: 0,
    versions: 0,
    dependencyEdges: 0,
    packageVersionEdges: 0,
    maintainers: 0,
    maintainsEdges: 0,
    processedNodes: 0,
    skippedNodes: 0,
    failedNodes: 0,
    maxDepth,
  };

  /*
   * ==========================================================
   * GLOBAL VISITED SET
   * ==========================================================
   *
   * npm:<package>@<resolved-version>
   *
   * Prevents cycles and duplicate recursive processing.
   */

  const visited = new Set<string>();

  let currentLevel: PackageRef[] = [
    {
      packageName,
      version,
      depth: 0,
    },
  ];

  /*
   * ==========================================================
   * BFS
   * ==========================================================
   */

  while (currentLevel.length > 0) {
    const depth =
      currentLevel[0].depth;

    console.log(
      `\n========== DEPTH ${depth} ==========`,
    );

    /*
     * --------------------------------------------------------
     * Deduplicate current level
     * --------------------------------------------------------
     */

    const levelToProcess: PackageRef[] = [];

    for (const ref of currentLevel) {
      const key = versionKey(
        ref.packageName,
        ref.version,
      );

      if (visited.has(key)) {
        stats.skippedNodes += 1;
        continue;
      }

      visited.add(key);
      levelToProcess.push(ref);
    }

    if (levelToProcess.length === 0) {
      break;
    }

    console.log(
      `Nodes: ${levelToProcess.length}`,
    );

    /*
     * ========================================================
     * BATCH COLLECTIONS
     * ========================================================
     */

    const packageVertices =
      new Map<number, PackageVertex>();

    const versionVertices =
      new Map<number, VersionVertex>();

    const maintainerVertices =
      new Map<number, MaintainerVertex>();

    const packageVersionEdges =
      new Map<string, PackageVersionEdge>();

    const maintainsEdges =
      new Map<number, MaintainsEdge>();

    const dependencyEdges =
      new Map<number, DependencyEdge>();

    const nextLevelMap =
      new Map<string, PackageRef>();

    /*
     * ========================================================
     * FETCH CURRENT LEVEL
     * ========================================================
     */

    const results = await mapConcurrent(
      levelToProcess,
      concurrency,
      async (ref) => {
        try {
          console.log(
            `Processing ${ref.packageName}@${ref.version}`,
          );

          const normalized =
            await fetchAndNormalize(ref);

          const resolvedDependencies =
            await resolveDependencies(
              normalized.dependencies,
              concurrency,
            );

          return {
            ref,
            normalized,
            resolvedDependencies,
            error: null,
          };
        } catch (error) {
          return {
            ref,
            normalized: null,
            resolvedDependencies: [],
            error,
          };
        }
      },
    );

    /*
     * ========================================================
     * BUILD GRAPH ROWS
     * ========================================================
     */

    for (const result of results) {
      if (
        result.error ||
        !result.normalized
      ) {
        stats.failedNodes += 1;

        console.error(
          `✗ Failed ` +
          `${result.ref.packageName}` +
          `@${result.ref.version}`,
          result.error,
        );

        continue;
      }

      stats.processedNodes += 1;

      const normalized =
        result.normalized;

      /*
       * ------------------------------------------------------
       * ROOT PACKAGE
       * ------------------------------------------------------
       */

      const rootPackageId =
        packageId(
          normalized.packageName,
        );

      const rootVersionId =
        versionId(
          normalized.packageName,
          normalized.version,
        );

      packageVertices.set(
        rootPackageId,
        {
          id: rootPackageId,
          name:
            normalized.packageName,
          ecosystem: "npm",
        },
      );

      /*
       * ------------------------------------------------------
       * ROOT VERSION
       * ------------------------------------------------------
       */

      versionVertices.set(
        rootVersionId,
        {
          id: rootVersionId,
          key: normalized.key,
          packageName:
            normalized.packageName,
          version:
            normalized.version,
          ecosystem: "npm",
        },
      );

      /*
       * ------------------------------------------------------
       * PACKAGE -> VERSION
       * ------------------------------------------------------
       */

      const rootPackageVersionEdgeId =
        packageVersionEdgeId(
          rootPackageId,
          rootVersionId,
        );

      packageVersionEdges.set(
        `${rootPackageId}:${rootVersionId}`,
        {
          id:
            rootPackageVersionEdgeId,
          packageId:
            rootPackageId,
          versionId:
            rootVersionId,
        },
      );

      /*
       * ------------------------------------------------------
       * MAINTAINERS
       * ------------------------------------------------------
       *
       * Expected normalized shape:
       *
       * maintainers: string[]
       *
       * Example:
       *
       * [
       *   "nick",
       *   "axios-maintainer"
       * ]
       */

      const maintainers =
        normalized.maintainers ?? [];

      for (
        const npmUsername
        of maintainers
      ) {
        if (!npmUsername) {
          continue;
        }

        const maintainerVertexId =
          maintainerId(
            npmUsername,
          );

        maintainerVertices.set(
          maintainerVertexId,
          {
            id:
              maintainerVertexId,
            username:
              npmUsername,
          },
        );

        const edgeId =
          maintainsEdgeId(
            maintainerVertexId,
            rootPackageId,
          );

        maintainsEdges.set(
          edgeId,
          {
            id: edgeId,
            maintainerId:
              maintainerVertexId,
            packageId:
              rootPackageId,
          },
        );
      }

      /*
       * ======================================================
       * DEPENDENCIES
       * ======================================================
       */

      for (
        const dependency
        of result.resolvedDependencies
      ) {
        /*
         * ----------------------------------------------------
         * DEPENDENCY PACKAGE
         * ----------------------------------------------------
         */

        const dependencyPackageId =
          packageId(
            dependency.name,
          );

        packageVertices.set(
          dependencyPackageId,
          {
            id:
              dependencyPackageId,
            name:
              dependency.name,
            ecosystem:
              "npm",
          },
        );

        /*
         * ----------------------------------------------------
         * DEPENDENCY VERSION
         * ----------------------------------------------------
         */

        const dependencyVersionId =
          versionId(
            dependency.name,
            dependency.version,
          );

        versionVertices.set(
          dependencyVersionId,
          {
            id:
              dependencyVersionId,
            key:
              versionKey(
                dependency.name,
                dependency.version,
              ),
            packageName:
              dependency.name,
            version:
              dependency.version,
            ecosystem:
              "npm",
          },
        );

        /*
         * ----------------------------------------------------
         * DEPENDENCY PACKAGE -> VERSION
         * ----------------------------------------------------
         */

        const dependencyPackageVersionEdgeId =
          packageVersionEdgeId(
            dependencyPackageId,
            dependencyVersionId,
          );

        packageVersionEdges.set(
          `${dependencyPackageId}:${dependencyVersionId}`,
          {
            id:
              dependencyPackageVersionEdgeId,
            packageId:
              dependencyPackageId,
            versionId:
              dependencyVersionId,
          },
        );

        /*
         * ----------------------------------------------------
         * VERSION -> VERSION
         * ----------------------------------------------------
         */

        const targetKey =
          versionKey(
            dependency.name,
            dependency.version,
          );

        const edgeId =
          dependencyEdgeId(
            normalized.key,
            targetKey,
          );

        dependencyEdges.set(
          edgeId,
          {
            id:
              edgeId,
            fromVersionId:
              rootVersionId,
            toVersionId:
              dependencyVersionId,
            packageName:
              dependency.name,
            versionRange:
              dependency.range,
            dependencyType:
              dependency.type,
          },
        );

        /*
         * ----------------------------------------------------
         * BFS EXPANSION
         * ----------------------------------------------------
         */

        if (depth < maxDepth) {
          const childKey =
            targetKey;

          if (!visited.has(childKey)) {
            nextLevelMap.set(
              childKey,
              {
                packageName:
                  dependency.name,
                version:
                  dependency.version,
                depth:
                  depth + 1,
              },
            );
          }
        }
      }
    }

    /*
     * ========================================================
     * CONVERT TO ARRAYS
     * ========================================================
     */

    const packages =
      Array.from(
        packageVertices.values(),
      );

    const versions =
      Array.from(
        versionVertices.values(),
      );

    const maintainers =
      Array.from(
        maintainerVertices.values(),
      );

    const packageVersionEdgeRows =
      Array.from(
        packageVersionEdges.values(),
      );

    const maintainsEdgeRows =
      Array.from(
        maintainsEdges.values(),
      );

    const dependencyEdgeRows =
      Array.from(
        dependencyEdges.values(),
      );

    /*
     * ========================================================
     * LOG
     * ========================================================
     */

    console.log(
      `\nWriting depth ${depth}...`,
    );

    console.log(
      `  Packages: ${packages.length}`,
    );

    console.log(
      `  Versions: ${versions.length}`,
    );

    console.log(
      `  Maintainers: ${maintainers.length}`,
    );

    console.log(
      `  HAS_VERSION: ` +
      `${packageVersionEdgeRows.length}`,
    );

    console.log(
      `  MAINTAINS: ` +
      `${maintainsEdgeRows.length}`,
    );

    console.log(
      `  DEPENDS_ON: ` +
      `${dependencyEdgeRows.length}`,
    );

    /*
     * ========================================================
     * WRITE VERTICES
     * ========================================================
     *
     * Vertices must exist before relationships.
     */

    await upsertPackages(
      packages,
    );

    await upsertVersions(
      versions,
    );

    await upsertMaintainers(
      maintainers,
    );

    /*
     * ========================================================
     * WRITE RELATIONSHIPS
     * ========================================================
     */

    await createPackageVersionEdges(
      packageVersionEdgeRows,
    );

    await createMaintainsEdges(
      maintainsEdgeRows,
    );

    await createDependencyEdges(
      dependencyEdgeRows,
    );

    /*
     * ========================================================
     * STATS
     * ========================================================
     */

    stats.packages +=
      packages.length;

    stats.versions +=
      versions.length;

    stats.maintainers +=
      maintainers.length;

    stats.packageVersionEdges +=
      packageVersionEdgeRows.length;

    stats.maintainsEdges +=
      maintainsEdgeRows.length;

    stats.dependencyEdges +=
      dependencyEdgeRows.length;

    /*
     * ========================================================
     * NEXT BFS LEVEL
     * ========================================================
     */

    currentLevel =
      Array.from(
        nextLevelMap.values(),
      );

    console.log(
      `Next depth nodes: ` +
      `${currentLevel.length}`,
    );
  }

  /*
   * ==========================================================
   * FINAL STATS
   * ==========================================================
   */

  console.log(
    "\n========================================",
  );

  console.log(
    "RECURSIVE INGESTION COMPLETE",
  );

  console.log(
    "========================================",
  );

  console.log(
    `Processed nodes: ` +
    `${stats.processedNodes}`,
  );

  console.log(
    `Skipped nodes:   ` +
    `${stats.skippedNodes}`,
  );

  console.log(
    `Failed nodes:    ` +
    `${stats.failedNodes}`,
  );

  console.log(
    `Packages:        ` +
    `${stats.packages}`,
  );

  console.log(
    `Versions:        ` +
    `${stats.versions}`,
  );

  console.log(
    `Maintainers:     ` +
    `${stats.maintainers}`,
  );

  console.log(
    `HAS_VERSION:     ` +
    `${stats.packageVersionEdges}`,
  );

  console.log(
    `MAINTAINS:       ` +
    `${stats.maintainsEdges}`,
  );

  console.log(
    `DEPENDS_ON:      ` +
    `${stats.dependencyEdges}`,
  );

  console.log(
    `Max depth:       ` +
    `${stats.maxDepth}`,
  );

  return stats;
}