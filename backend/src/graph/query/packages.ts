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
  publishedAt?: string | null;
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

  /*
   * Versions with a known publish time get it written;
   * versions without one must not clobber a value
   * already stored by a previous ingestion.
   */
  const withTime = versions.filter(
    (version) => !!version.publishedAt,
  );

  const withoutTime = versions.filter(
    (version) => !version.publishedAt,
  );

  const baseSet = `
        n.key = row.key,
        n.packageName = row.packageName,
        n.version = row.version,
        n.ecosystem = row.ecosystem
  `;

  if (withTime.length > 0) {
    const query = `
      UNWIND $rows AS row
      MERGE (n {id: row.vertex})
      SET n:Version,
          ${baseSet}
          n.publishedAt = row.publishedAt
    `;

    await hydraQuery(query, {
      params: {
        rows: withTime.map((version) => ({
          vertex: version.id,
          key: version.key,
          packageName: version.packageName,
          version: version.version,
          ecosystem: version.ecosystem,
          publishedAt: version.publishedAt,
        })),
      },
    });
  }

  if (withoutTime.length > 0) {
    const query = `
      UNWIND $rows AS row
      MERGE (n {id: row.vertex})
      SET n:Version,
          ${baseSet}
    `;

    await hydraQuery(query, {
      params: {
        rows: withoutTime.map((version) => ({
          vertex: version.id,
          key: version.key,
          packageName: version.packageName,
          version: version.version,
          ecosystem: version.ecosystem,
        })),
      },
    });
  }
}
export async function createPackageVersionEdges(
  edges: Array<{
    id: number;
    packageId: number;
    versionId: number;
  }>,
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row

    MATCH
      (p:Package {id: row.packageId}),
      (v:Version {id: row.versionId})

    MERGE
      (p)-[r:HAS_VERSION {id: row.id}]->(v)

    SET
      r.packageId = row.packageId,
      r.versionId = row.versionId
  `;

  await hydraQuery(query, {
    params: {
      rows: edges,
    },
  });
}