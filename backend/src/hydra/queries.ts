import { hydraQuery } from "./client";
import { cleanHydraRows } from "./row";

export interface Package {
  id: string;
  name: string;
  version: string;
}

export async function getPackage(
  id: string,
): Promise<Package | null> {
  const result = await hydraQuery(
    `
    MATCH (p:Package {id: $id})
    RETURN p.id AS id,
           p.name AS name,
           p.version AS version
    LIMIT 1
    `,
    {
      params: { id },
    },
  );

  const rows = cleanHydraRows<Package>(
    result.columns,
    result.rows,
  );

  return rows[0] ?? null;
}