import { hydraQuery } from "../hydra/client";

export async function getPackageVersions(packageName: string) {
  const query = `
    MATCH (p:Package)-[:HAS_VERSION]->(v:Version)
    WHERE p.name = $packageName
    RETURN p.name AS package_name, v.key AS version_key
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
    RETURN v.key,
           d.id,
           d.packageName,
           d.versionRange,
           d.dependencyType,
           target.key,
           target.packageName,
           target.version
  `;

  return hydraQuery(query, {
    params: {
      versionKey,
    },
  });
}