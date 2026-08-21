/**
 * PyPI Package Ingestion Pipeline
 *
 * Crawls a PyPI package and its transitive dependencies,
 * writing Package, Version, Maintainer vertices and
 * DEPENDS_ON, HAS_VERSION, MAINTAINS edges into HydraDB.
 *
 * Uses the same graph structure as npm but with "pypi:" prefix.
 */

import {
  fetchPyPIPackage,
  fetchPyPIVersion,
  releasePublishedAt,
} from "./registry";
import {
  normalizePyPIVersion,
  type NormalizedDependency,
} from "./normalize";
import { resolvePyPIVersionMeta } from "./resolver";
import {
  upsertPackages,
  upsertVersions,
  createPackageVersionEdges,
  type PackageVertex,
  type VersionVertex,
} from "../graph/query/packages";
import {
  upsertMaintainers,
  createMaintainsEdges,
  type MaintainerVertex,
  type MaintainsEdge,
} from "../graph/query/maintainers";
import {
  createDependencyEdges,
  type DependencyEdge,
} from "../graph/query/dependencies";

export interface PyPIIngestOptions {
  packageName: string;
  version: string;
  maxDepth: number;
  concurrency?: number;
}

export interface PyPIIngestStats {
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
  publishedAt: string | null;
  type: "runtime" | "optional" | "peer";
}

interface PackageVersionEdge {
  id: number;
  packageId: number;
  versionId: number;
}

// ── Deterministic IDs (pypi: prefix) ──────────────────────────

function stableNumericId(key: string): number {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) + 1;
}

export function packageId(packageName: string): number {
  return stableNumericId(`package:pypi:${packageName}`);
}

export function versionId(
  packageName: string,
  version: string,
): number {
  return stableNumericId(`version:pypi:${packageName}@${version}`);
}

function maintainerId(name: string): number {
  return stableNumericId(`maintainer:pypi:${name}`);
}

function packageVersionEdgeId(
  pkgId: number,
  verId: number,
): number {
  return stableNumericId(`has-version-pypi:${pkgId}->${verId}`);
}

function maintainsEdgeId(
  maintainer: number,
  pkg: number,
): number {
  return stableNumericId(`maintains-pypi:${maintainer}->${pkg}`);
}

function dependencyEdgeId(
  sourceKey: string,
  targetKey: string,
): number {
  return stableNumericId(`dependency-pypi:${sourceKey}->${targetKey}`);
}

function versionKey(
  packageName: string,
  version: string,
): string {
  return `pypi:${packageName}@${version}`;
}

// ── Concurrency helper ────────────────────────────────────────

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  return results;
}

// ── Dependency resolution ─────────────────────────────────────

async function resolveDependencies(
  dependencies: NormalizedDependency[],
  concurrency: number,
): Promise<ResolvedDependency[]> {
  return mapConcurrent(dependencies, concurrency, async (dep) => {
    try {
      const meta = await resolvePyPIVersionMeta(
        dep.name,
        dep.range,
      );
      return {
        name: dep.name,
        range: dep.range,
        version: meta.version,
        publishedAt: meta.publishedAt,
        type: dep.type,
      };
    } catch {
      // If resolution fails, skip this dependency
      return null;
    }
  }).then((results) =>
    results.filter((r): r is ResolvedDependency => r !== null),
  );
}

// ── Main ingest function ──────────────────────────────────────

export async function ingestPyPIPackage(
  options: PyPIIngestOptions,
): Promise<PyPIIngestStats> {
  const {
    packageName,
    version,
    maxDepth,
    concurrency = 5,
  } = options;

  if (maxDepth < 0) {
    throw new Error("maxDepth must be >= 0");
  }

  const stats: PyPIIngestStats = {
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

  const visited = new Set<string>();

  let currentLevel: PackageRef[] = [
    { packageName, version, depth: 0 },
  ];

  // ── BFS ─────────────────────────────────────────────────────

  while (currentLevel.length > 0) {
    const depth = currentLevel[0].depth;

    console.log(`\n========== PYPI DEPTH ${depth} ==========`);

    // Deduplicate
    const levelToProcess: PackageRef[] = [];
    for (const ref of currentLevel) {
      const key = versionKey(ref.packageName, ref.version);
      if (visited.has(key)) {
        stats.skippedNodes += 1;
        continue;
      }
      visited.add(key);
      levelToProcess.push(ref);
    }

    if (levelToProcess.length === 0) break;

    console.log(`Nodes: ${levelToProcess.length}`);

    // Batch collections
    const packageVertices = new Map<number, PackageVertex>();
    const versionVertices = new Map<number, VersionVertex>();
    const maintainerVertices = new Map<number, MaintainerVertex>();
    const packageVersionEdges = new Map<string, PackageVersionEdge>();
    const maintainsEdges = new Map<number, MaintainsEdge>();
    const dependencyEdges = new Map<number, DependencyEdge>();
    const nextLevelMap = new Map<string, PackageRef>();

    // Fetch current level
    const results = await mapConcurrent(
      levelToProcess,
      concurrency,
      async (ref) => {
        try {
          console.log(`Processing pypi:${ref.packageName}@${ref.version}`);

          // PyPI releases entries are distribution file metadata,
          // not version info. Always use info or fetch specific version.
          let versionInfo;
          let rootPublishedAt: string | null = null;

          try {
            const pkgData = await fetchPyPIPackage(ref.packageName);
            // The /pypi/:pkg/json endpoint returns `info` for the
            // latest version. If we need a specific version, use
            // the version-specific endpoint.
            if (pkgData.info.version === ref.version) {
              versionInfo = pkgData.info;
            }
            // Publish time comes from the release's distribution files
            rootPublishedAt = releasePublishedAt(
              pkgData.releases?.[ref.version],
            );
          } catch {
            // ignore — will fall through to version-specific fetch
          }

          if (!versionInfo) {
            const versionData = await fetchPyPIVersion(
              ref.packageName,
              ref.version,
            );
            versionInfo = versionData.info;
            if (!rootPublishedAt) {
              rootPublishedAt = versionData.publishedAt;
            }
          }

          const normalized = normalizePyPIVersion(
            versionInfo,
            rootPublishedAt,
          );
          const resolvedDeps = await resolveDependencies(
            normalized.dependencies,
            concurrency,
          );

          return { ref, normalized, resolvedDependencies: resolvedDeps, error: null };
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

    // Build graph rows
    for (const result of results) {
      if (result.error || !result.normalized) {
        stats.failedNodes += 1;
        console.error(
          `✗ Failed pypi:${result.ref.packageName}@${result.ref.version}`,
          result.error,
        );
        continue;
      }

      stats.processedNodes += 1;
      const normalized = result.normalized;

      // Root package
      const rootPackageId = packageId(normalized.packageName);
      const rootVersionId = versionId(
        normalized.packageName,
        normalized.version,
      );

      packageVertices.set(rootPackageId, {
        id: rootPackageId,
        name: normalized.packageName,
        ecosystem: "npm", // We reuse the PackageVertex type but this is pypi
      } as PackageVertex);

      versionVertices.set(rootVersionId, {
        id: rootVersionId,
        key: normalized.key,
        packageName: normalized.packageName,
        version: normalized.version,
        ecosystem: "npm",
        publishedAt: normalized.publishedAt,
      } as VersionVertex);

      // Package → Version edge
      const pvEdgeId = packageVersionEdgeId(rootPackageId, rootVersionId);
      packageVersionEdges.set(
        `${rootPackageId}:${rootVersionId}`,
        { id: pvEdgeId, packageId: rootPackageId, versionId: rootVersionId },
      );

      // Maintainers
      const maintainers = normalized.maintainers ?? [];
      for (const username of maintainers) {
        if (!username) continue;

        const mId = maintainerId(username);
        maintainerVertices.set(mId, { id: mId, username });

        const meId = maintainsEdgeId(mId, rootPackageId);
        maintainsEdges.set(meId, {
          id: meId,
          maintainerId: mId,
          packageId: rootPackageId,
        });
      }

      // Dependencies
      for (const dep of result.resolvedDependencies) {
        const depPackageId = packageId(dep.name);
        const depVersionId = versionId(dep.name, dep.version);
        const depKey = versionKey(dep.name, dep.version);

        packageVertices.set(depPackageId, {
          id: depPackageId,
          name: dep.name,
          ecosystem: "npm",
        } as PackageVertex);

        versionVertices.set(depVersionId, {
          id: depVersionId,
          key: depKey,
          packageName: dep.name,
          version: dep.version,
          ecosystem: "npm",
          publishedAt: dep.publishedAt,
        } as VersionVertex);

        // Package → Version
        const depPvId = packageVersionEdgeId(depPackageId, depVersionId);
        packageVersionEdges.set(
          `${depPackageId}:${depVersionId}`,
          { id: depPvId, packageId: depPackageId, versionId: depVersionId },
        );

        // Version → Version (DEPENDS_ON)
        const dEdgeId = dependencyEdgeId(normalized.key, depKey);
        dependencyEdges.set(dEdgeId, {
          id: dEdgeId,
          fromVersionId: rootVersionId,
          toVersionId: depVersionId,
          packageName: dep.name,
          versionRange: dep.range,
          dependencyType: dep.type,
        });

        // BFS expansion
        if (depth < maxDepth && !visited.has(depKey)) {
          nextLevelMap.set(depKey, {
            packageName: dep.name,
            version: dep.version,
            depth: depth + 1,
          });
        }
      }
    }

    // Write to HydraDB
    const packages = Array.from(packageVertices.values());
    const versions = Array.from(versionVertices.values());
    const maintainerList = Array.from(maintainerVertices.values());
    const pvEdges = Array.from(packageVersionEdges.values());
    const maintEdges = Array.from(maintainsEdges.values());
    const depEdges = Array.from(dependencyEdges.values());

    console.log(`\nWriting PyPI depth ${depth}...`);
    console.log(`  Packages: ${packages.length}`);
    console.log(`  Versions: ${versions.length}`);
    console.log(`  Maintainers: ${maintainerList.length}`);
    console.log(`  HAS_VERSION: ${pvEdges.length}`);
    console.log(`  MAINTAINS: ${maintEdges.length}`);
    console.log(`  DEPENDS_ON: ${depEdges.length}`);

    try {
      await upsertPackages(packages as any);
      await upsertVersions(versions as any);
      await upsertMaintainers(maintainerList);
      await createPackageVersionEdges(pvEdges as any);
      await createMaintainsEdges(maintEdges);
      await createDependencyEdges(depEdges);
    } catch (writeError) {
      console.error(`Write failed at depth ${depth}:`, writeError);
    }

    // Update stats
    stats.packages += packages.length;
    stats.versions += versions.length;
    stats.maintainers += maintainerList.length;
    stats.packageVersionEdges += pvEdges.length;
    stats.maintainsEdges += maintEdges.length;
    stats.dependencyEdges += depEdges.length;

    // Next level
    currentLevel = Array.from(nextLevelMap.values());
    console.log(`Next depth nodes: ${currentLevel.length}`);
  }

  console.log("\n========================================");
  console.log("PYPI INGESTION COMPLETE");
  console.log("========================================");
  console.log(`Processed: ${stats.processedNodes}`);
  console.log(`Skipped:   ${stats.skippedNodes}`);
  console.log(`Failed:    ${stats.failedNodes}`);
  console.log(`Packages:  ${stats.packages}`);
  console.log(`Versions:  ${stats.versions}`);
  console.log(`Max depth: ${stats.maxDepth}`);

  return stats;
}
