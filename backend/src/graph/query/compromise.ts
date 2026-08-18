import { hydraQuery } from "../../hydra/client";

export interface CompromiseResult {
  versionKey: string;
  packageName: string;
  version: string;
  maintainerCount: number;
  dependencyCount: number;
}

export async function getCompromiseInfo(
  versionKey: string,
): Promise<CompromiseResult> {
  const result = await hydraQuery(
    `
      MATCH (v:Version {key: $key})

      RETURN
        v.key AS versionKey,
        v.packageName AS packageName,
        v.version AS version
    `,
    {
      params: {
        key: versionKey,
      },
    },
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Version not found: ${versionKey}`,
    );
  }

  const row = result.rows[0];

  const dependencyResult = await hydraQuery(
    `
      MATCH
        (v:Version {key: $key})
          -[:DEPENDS_ON]->(d:Version)

      RETURN count(*) AS count
    `,
    {
      params: {
        key: versionKey,
      },
    },
  );

  const maintainerResult = await hydraQuery(
    `
      MATCH
        (m:Maintainer)
          -[:MAINTAINS]->
          (p:Package)
          -[:HAS_VERSION]->
          (v:Version {key: $key})

      RETURN count(*) AS count
    `,
    {
      params: {
        key: versionKey,
      },
    },
  );

  return {
    versionKey: String(row.versionKey),
    packageName: String(row.packageName),
    version: String(row.version),
    dependencyCount: Number(
      dependencyResult.rows[0]?.count ?? 0,
    ),
    maintainerCount: Number(
      maintainerResult.rows[0]?.count ?? 0,
    ),
  };
}