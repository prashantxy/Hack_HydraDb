import { hydraQuery } from "../../hydra/client";

export interface PackageVertex {
  id: number;
  name: string;
  ecosystem: "npm";
}

export interface VersionVertex {
  id: number;
  key: string;
  packageName: string;
  version: string;
  ecosystem: "npm";
}

export async function upsertPackages(
  packages: PackageVertex[],
): Promise<void> {
  if (packages.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row
    MERGE (n {id: row.vertex})
    SET n:Package,
        n.name = row.name,
        n.ecosystem = row.ecosystem
  `;

  await hydraQuery(query, {
    params: {
      rows: packages.map((pkg) => ({
        vertex: pkg.id,
        name: pkg.name,
        ecosystem: pkg.ecosystem,
      })),
    },
  });
}

export async function upsertVersions(
  versions: VersionVertex[],
): Promise<void> {
  if (versions.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row
    MERGE (n {id: row.vertex})
    SET n:Version,
        n.key = row.key,
        n.packageName = row.packageName,
        n.version = row.version,
        n.ecosystem = row.ecosystem
  `;

  await hydraQuery(query, {
    params: {
      rows: versions.map((version) => ({
        vertex: version.id,
        key: version.key,
        packageName: version.packageName,
        version: version.version,
        ecosystem: version.ecosystem,
      })),
    },
  });
}
export async function createPackageVersionEdges(
  edges: Array<{
    packageId: number;
    versionId: number;
  }>,
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row
    MATCH (p:Package {id: row.packageId}),
          (v:Version {id: row.versionId})
    CREATE (p)-[:HAS_VERSION]->(v)
  `;

  await hydraQuery(query, {
    params: {
      rows: edges,
    },
  });
}