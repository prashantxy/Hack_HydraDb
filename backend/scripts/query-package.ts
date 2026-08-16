import { hydraQuery } from "../src/hydra/client";

const result = await hydraQuery(`
  MATCH (v:Version)-[d:DEPENDS_ON]->(target:Version)
  WHERE v.key = $versionKey
  RETURN v.key AS source,
         d.packageName AS package_name,
         d.versionRange AS version_range,
         d.dependencyType AS dependency_type,
         target.key AS target
`, {
  params: {
    versionKey: "npm:axios@1.7.2",
  },
});

console.dir(result, { depth: null });