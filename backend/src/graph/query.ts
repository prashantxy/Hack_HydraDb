import { hydraQuery } from "../hydra/client";

export async function getPackageVersions(
  packageName: string,
) {
  const query = `
    MATCH (p:Package)-[:HAS_VERSION]->(v:Version)
    WHERE p.name = $packageName

    RETURN
      p.name AS name,
      v.key AS key,
      v.version AS version
  `;

  return hydraQuery(query, {
    params: {
      packageName,
    },
  });
}

export async function getDependencies(
  versionKey: string,
) {
  const query = `
    MATCH (source:Version)-[d:DEPENDS_ON]->(target:Version)
    WHERE source.key = $versionKey

    RETURN
      source.key AS source,
      d.packageName AS packageName,
      d.versionRange AS versionRange,
      d.dependencyType AS dependencyType,
      target.key AS target
  `;

  return hydraQuery(query, {
    params: {
      versionKey,
    },
  });
}