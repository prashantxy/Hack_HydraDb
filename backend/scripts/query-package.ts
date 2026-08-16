import { hydraQuery } from "../src/hydra/client";

const result = await hydraQuery(`
  MATCH (p:Package)-[:HAS_VERSION]->(v:Version)
  WHERE p.name = $packageName
  RETURN p.name AS package_name,
         v.key AS version_key,
         v.version AS version
`, {
  params: {
    packageName: "axios",
  },
});

console.dir(result, { depth: null });