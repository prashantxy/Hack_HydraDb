import { hydraQuery } from "../hydra/client";

export async function getPackageVersions(packageName: string) {
  const query = `
    MATCH (p:Package)-[:HAS_VERSION]->(v:Version)
    WHERE p.name = $packageName
    RETURN p.name AS package_name,
           v.key AS version_key,
           v.version AS version
  `;

  return hydraQuery(query, {
    params: {
      packageName,
    },
  });
}

export async function getDependencies(versionKey: string) {
  const query = `
    MATCH (v:Version)-[d:DEPENDS_ON]->(target:Version)
    WHERE v.key = $versionKey
    RETURN v.key AS source,
           d.packageName AS package_name,
           d.versionRange AS version_range,
           d.dependencyType AS dependency_type,
           target.key AS target
  `;

  return hydraQuery(query, {
    params: {
      versionKey,
    },
  });
}