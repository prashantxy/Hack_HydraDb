import {
  cleanHydraRows,
} from "../hydra/rows";

import {
  getPackageVersions,
  getDependencies,
} from "./query";

import {
  getVersionDependencies,
  getPackageVersionKeys,
} from "./query/graph";

export interface PackageVersionInfo {
  name: string;
  key: string;
  version: string;
}

export interface PackageDependencyInfo {
  source: string;
  packageName: string;
  versionRange: string;
  dependencyType: string;
  target: string;
}

export interface GraphNode {
  id: string;
  packageName: string;
  version: string;
  depth: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  packageName: string;
  versionRange: string;
  dependencyType: string;
  depth: number;
}

export async function packageInfo(
  packageName: string,
) {
  const result = await getPackageVersions(
    packageName,
  );

  const versions =
    cleanHydraRows<PackageVersionInfo>(
      result.columns,
      result.rows,
    );

  return {
    name: packageName,
    versions,
  };
}

export async function packageDependencies(
  versionKey: string,
) {
  const result = await getDependencies(
    versionKey,
  );

  return cleanHydraRows<PackageDependencyInfo>(
    result.columns,
    result.rows,
  );
}

export async function packageGraph(
  packageName: string,
  depth = 1,
) {
  const safeDepth = Math.min(
    Math.max(depth, 1),
    5,
  );

  const rootVersions =
    await getPackageVersionKeys(packageName);

  if (rootVersions.length === 0) {
    return {
      package: packageName,
      depth: safeDepth,
      nodes: [],
      edges: [],
    };
  }

  const nodes = new Map<
    string,
    GraphNode
  >();

  const edges: GraphEdge[] = [];

  let currentLevel = rootVersions;

  // Add root versions.
  for (const key of rootVersions) {
    const [pkg, version] =
      parseVersionKey(key);

    nodes.set(key, {
      id: key,
      packageName: pkg,
      version,
      depth: 0,
    });
  }

  const visited = new Set(
    rootVersions,
  );

  for (
    let currentDepth = 1;
    currentDepth <= safeDepth;
    currentDepth++
  ) {
    if (currentLevel.length === 0) {
      break;
    }

    const rows =
      await getVersionDependencies(
        currentLevel,
      );

    const nextLevel: string[] = [];

    for (const row of rows) {
      if (!row.target) {
        continue;
      }

      if (
        !row.packageName ||
        !row.versionRange ||
        !row.dependencyType
      ) {
        continue;
      }

      if (!nodes.has(row.target)) {
        nodes.set(row.target, {
          id: row.target,
          packageName:
            row.targetPackage ??
            parseVersionKey(row.target)[0],
          version:
            row.targetVersion ??
            parseVersionKey(row.target)[1],
          depth: currentDepth,
        });
      }

      const edgeExists = edges.some(
        (edge) =>
          edge.source === row.source &&
          edge.target === row.target,
      );

      if (!edgeExists) {
        edges.push({
          source: row.source,
          target: row.target,
          packageName: row.packageName,
          versionRange: row.versionRange,
          dependencyType:
            row.dependencyType,
          depth: currentDepth,
        });
      }

      if (
        !visited.has(row.target)
      ) {
        visited.add(row.target);
        nextLevel.push(row.target);
      }
    }

    currentLevel = nextLevel;
  }

  return {
    package: packageName,
    depth: safeDepth,
    nodes: Array.from(nodes.values()),
    edges,
  };
}

function parseVersionKey(
  key: string,
): [string, string] {
  const prefix = "npm:";

  const value = key.startsWith(prefix)
    ? key.slice(prefix.length)
    : key;

  const separator = value.lastIndexOf("@");

  if (separator <= 0) {
    return [value, ""];
  }

  return [
    value.slice(0, separator),
    value.slice(separator + 1),
  ];
}