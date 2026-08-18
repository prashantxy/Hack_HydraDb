import {
  fetchNpmPackage,
} from "./registry";

import {
  normalizePackageVersion,
  type NormalizedDependency,
  type NormalizedPackageVersion,
} from "./normalize";

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

function stableNumericId(key: string): number {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) + 1;
}

function packageId(
  packageName: string,
): number {
  return stableNumericId(
    `package:npm:${packageName}`,
  );
}

function versionId(
  packageName: string,
  version: string,
): number {
  return stableNumericId(
    `version:npm:${packageName}@${version}`,
  );
}

function versionKey(
  packageName: string,
  version: string,
): string {
  return `npm:${packageName}@${version}`;
}

function packageVersionEdgeId(
  packageId: number,
  versionId: number,
): number {
  return stableNumericId(
    `has-version:${packageId}->${versionId}`,
  );
}

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
      { length: workerCount },
      () => runWorker(),
    ),
  );

  return results;
}

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
    processedNodes: 0,
    skippedNodes: 0,
    failedNodes: 0,
    maxDepth,
  };

  /*
   * Global visited set.

   * Key:
   * npm:<package>@<resolved-version>
   *
   * This prevents cycles and prevents the same
   * package/version from being recursively processed
   * multiple times.
   */
  const visited = new Set<string>();

  let currentLevel: PackageRef[] = [
    {
      packageName,
      version,
      depth: 0,
    },
  ];

  while (currentLevel.length > 0) {
    const depth =
      currentLevel[0].depth;

    console.log(
      `\n========== DEPTH ${depth} ==========`,
    );

    /*
     * Remove already-visited nodes before processing
     * this level.
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
     * Batch collections for this BFS level.
     */
    const packageVertices =
      new Map<number, PackageVertex>();

    const versionVertices =
      new Map<number, VersionVertex>();

    const packageVersionEdges =
      new Map<string, PackageVersionEdge>();

    const dependencyEdges =
      new Map<number, DependencyEdge>();

    /*
     * Children discovered at this level.
     */
    const nextLevelMap =
      new Map<string, PackageRef>();

    /*
     * Fetch and resolve all packages in the
     * current BFS level concurrently.
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
     * Convert results into graph rows.
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

      const rootPackageId =
        packageId(
          normalized.packageName,
        );

      const rootVersionId =
        versionId(
          normalized.packageName,
          normalized.version,
        );

      /*
       * Package vertex.
       */
      packageVertices.set(
        rootPackageId,
        {
          id: rootPackageId,
          name: normalized.packageName,
          ecosystem: "npm",
        },
      );

      /*
       * Version vertex.
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
       * Package -> Version
       *
       * IMPORTANT:
       * HydraDB requires an explicit relationship ID
       * when MERGE is used inside UNWIND.
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
       * Process dependencies.
       */
      for (
        const dependency
        of result.resolvedDependencies
      ) {
        const dependencyPackageId =
          packageId(
            dependency.name,
          );

        const dependencyVersionId =
          versionId(
            dependency.name,
            dependency.version,
          );

        /*
         * Dependency Package vertex.
         */
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
         * Dependency Version vertex.
         */
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
         * Dependency Package -> Version.
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
         * Version -> Version dependency edge.
         */
        const edgeId =
          stableNumericId(
            `dependency:` +
            `${normalized.key}->` +
            `${versionKey(
              dependency.name,
              dependency.version,
            )}`,
          );

        dependencyEdges.set(
          edgeId,
          {
            id: edgeId,
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
         * BFS expansion.
         *
         * Don't recurse beyond maxDepth.
         */
        if (depth < maxDepth) {
          const childKey =
            versionKey(
              dependency.name,
              dependency.version,
            );

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
     * Convert maps into HydraDB batch rows.
     */
    const packages =
      Array.from(
        packageVertices.values(),
      );

    const versions =
      Array.from(
        versionVertices.values(),
      );

    const packageVersionEdgeRows =
      Array.from(
        packageVersionEdges.values(),
      );

    const dependencyEdgeRows =
      Array.from(
        dependencyEdges.values(),
      );

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
      `  HAS_VERSION: ` +
      `${packageVersionEdgeRows.length}`,
    );

    console.log(
      `  DEPENDS_ON: ` +
      `${dependencyEdgeRows.length}`,
    );

    /*
     * Write vertices first.
     */
    await upsertPackages(
      packages,
    );

    await upsertVersions(
      versions,
    );

    /*
     * Then relationships.
     */
    await createPackageVersionEdges(
      packageVersionEdgeRows,
    );

    await createDependencyEdges(
      dependencyEdgeRows,
    );

    /*
     * Update statistics.
     */
    stats.packages +=
      packages.length;

    stats.versions +=
      versions.length;

    stats.packageVersionEdges +=
      packageVersionEdgeRows.length;

    stats.dependencyEdges +=
      dependencyEdgeRows.length;

    /*
     * Move to next BFS level.
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
    `HAS_VERSION:     ` +
    `${stats.packageVersionEdges}`,
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