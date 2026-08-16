import {
  fetchNpmPackage,
} from "../src/npm/registry";

import {
  normalizePackageVersion,
} from "../src/npm/normalize";

import {
  resolveVersion,
} from "../src/npm/resolver";

import {
  hydraQuery,
} from "../src/hydra/client";

import {
  upsertPackages,
  upsertVersions,
  createPackageVersionEdges,
  type PackageVertex,
  type VersionVertex,
} from "../src/graph/packages";

import {
  createDependencyEdges,
  type DependencyEdge,
} from "../src/graph/dependencies";

const packageName = process.argv[2] ?? "axios";
const requestedVersion = process.argv[3] ?? "1.7.2";

function stableNumericId(key: string): number {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const positive = hash >>> 0;

  // Keep IDs safely positive and away from 0.
  return positive + 1;
}

console.log(
  `Fetching ${packageName}@${requestedVersion}...`,
);

const metadata = await fetchNpmPackage(packageName);

const versionMetadata =
  metadata.versions[requestedVersion];

if (!versionMetadata) {
  throw new Error(
    `${packageName}@${requestedVersion} ` +
    `does not exist in the npm registry`,
  );
}

const normalized =
  normalizePackageVersion(versionMetadata);

console.log(
  `Found ${normalized.key}`,
);

console.log(
  `Dependencies: ${normalized.dependencies.length}`,
);

const resolvedDependencies: Array<{
  name: string;
  range: string;
  version: string;
  type: "runtime" | "optional" | "peer";
}> = [];

for (const dependency of normalized.dependencies) {
  console.log(
    `Resolving ${dependency.name}@${dependency.range}...`,
  );

  const version = await resolveVersion(
    dependency.name,
    dependency.range,
  );

  resolvedDependencies.push({
    name: dependency.name,
    range: dependency.range,
    version,
    type: dependency.type,
  });

  console.log(
    `  → ${dependency.name}@${version}`,
  );
}

const rootPackageId =
  stableNumericId(
    `package:npm:${packageName}`,
  );

const rootVersionId =
  stableNumericId(
    `version:npm:${packageName}@${requestedVersion}`,
  );

const packageVertices: PackageVertex[] = [
  {
    id: rootPackageId,
    name: packageName,
    ecosystem: "npm",
  },
];

const versionVertices: VersionVertex[] = [
  {
    id: rootVersionId,
    key: `npm:${packageName}@${requestedVersion}`,
    packageName,
    version: requestedVersion,
    ecosystem: "npm",
  },
];

const packageVersionEdges = [
  {
    packageId: rootPackageId,
    versionId: rootVersionId,
  },
];

const dependencyEdges: DependencyEdge[] = [];

for (const dependency of resolvedDependencies) {
  const packageId =
    stableNumericId(
      `package:npm:${dependency.name}`,
    );

  const versionId =
    stableNumericId(
      `version:npm:${dependency.name}@${dependency.version}`,
    );

  packageVertices.push({
    id: packageId,
    name: dependency.name,
    ecosystem: "npm",
  });

  versionVertices.push({
    id: versionId,
    key:
      `npm:${dependency.name}@${dependency.version}`,
    packageName: dependency.name,
    version: dependency.version,
    ecosystem: "npm",
  });

  packageVersionEdges.push({
    packageId,
    versionId,
  });

  dependencyEdges.push({
    id: stableNumericId(
      `dependency:${normalized.key}->` +
      `npm:${dependency.name}@${dependency.version}`,
    ),
    fromVersionId: rootVersionId,
    toVersionId: versionId,
    packageName: dependency.name,
    versionRange: dependency.range,
    dependencyType: dependency.type,
  });
}

console.log("Writing package vertices...");

await upsertPackages(packageVertices);

console.log("Writing version vertices...");

await upsertVersions(versionVertices);

console.log("Writing HAS_VERSION edges...");

await createPackageVersionEdges(
  packageVersionEdges,
);

console.log("Writing DEPENDS_ON edges...");

await createDependencyEdges(
  dependencyEdges,
);

console.log("Verifying graph...");

const result = await hydraQuery(
  `
    MATCH
      (v:Version {
        key: $rootKey
      })-[:DEPENDS_ON]->(d:Version)

    RETURN
      d.id AS id,
      d.key AS key,
      d.packageName AS packageName,
      d.version AS version
    ORDER BY d.key
  `,
  {
    params: {
      rootKey:
        `npm:${packageName}@${requestedVersion}`,
    },
  },
);

console.log("\nHydraDB dependencies:\n");

for (const row of result.rows) {
  console.log(JSON.stringify(row, null, 2));
}

console.log(
  `\nIngestion complete: ` +
  `${packageName}@${requestedVersion}`,
);