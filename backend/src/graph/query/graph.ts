import { hydraQuery } from "../../hydra/client";

export interface GraphDependencyRow {
  source: string;
  sourcePackage: string;
  sourceVersion: string;

  packageName: string | null;
  versionRange: string | null;
  dependencyType: string | null;

  target: string | null;
  targetPackage: string | null;
  targetVersion: string | null;
}

export async function getVersionDependencies(
  versionKeys: string[],
): Promise<GraphDependencyRow[]> {
  if (versionKeys.length === 0) {
    return [];
  }

  const results: GraphDependencyRow[] = [];

  for (const versionKey of versionKeys) {
    const query = `
      MATCH (source:Version {key: $versionKey})-[d:DEPENDS_ON]->(target:Version)
      RETURN
        source.key AS source,
        source.packageName AS sourcePackage,
        source.version AS sourceVersion,
        d.packageName AS packageName,
        d.versionRange AS versionRange,
        d.dependencyType AS dependencyType,
        target.key AS target,
        target.packageName AS targetPackage,
        target.version AS targetVersion
    `;

    const result = await hydraQuery(query, {
      params: {
        versionKey,
      },
    });

    for (const row of result.rows) {
      results.push({
        source: row[0]?.value as string,
        sourcePackage: row[1]?.value as string,
        sourceVersion: row[2]?.value as string,
        packageName: (row[3]?.value as string | null) ?? null,
        versionRange: (row[4]?.value as string | null) ?? null,
        dependencyType: (row[5]?.value as string | null) ?? null,
        target: (row[6]?.value as string | null) ?? null,
        targetPackage: (row[7]?.value as string | null) ?? null,
        targetVersion: (row[8]?.value as string | null) ?? null,
      });
    }
  }

  return results;
}

export async function getPackageVersionKeys(
  packageName: string,
): Promise<string[]> {
  const query = `
    MATCH (p:Package {name: $packageName})-[:HAS_VERSION]->(v:Version)
    RETURN v.key AS key
  `;

  const result = await hydraQuery(query, {
    params: {
      packageName,
    },
  });

  return result.rows.map(
    (row) => row[0]?.value as string,
  );
}