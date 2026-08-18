import { hydraQuery } from "../../hydra/client";

export interface MaintainerVertex {
  id: number;
  username: string;
}

export interface MaintainsEdge {
  id: number;
  maintainerId: number;
  packageId: number;
}

/*
 * ============================================================
 * UPSERT MAINTAINERS
 * ============================================================
 */

export async function upsertMaintainers(
  maintainers: MaintainerVertex[],
): Promise<void> {
  if (maintainers.length === 0) {
    return;
  }

  const rows = maintainers.map((maintainer) => ({
    id: Number(maintainer.id),
    username: String(maintainer.username),
  }));

  await hydraQuery(
    `
      UNWIND $rows AS row
      MERGE (m {id: row.id})
      SET
        m:Maintainer,
        m.username = row.username
    `,
    {
      params: {
        rows,
      },
    },
  );
}

/*
 * ============================================================
 * CREATE MAINTAINS EDGES
 * ============================================================
 */

export async function createMaintainsEdges(
  edges: MaintainsEdge[],
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  const rows = edges.map((edge) => ({
    id: Number(edge.id),
    maintainerId: Number(edge.maintainerId),
    packageId: Number(edge.packageId),
  }));

  await hydraQuery(
    `
      UNWIND $rows AS row
      MATCH
        (m:Maintainer {id: row.maintainerId}),
        (p:Package {id: row.packageId})
      CREATE (m)-[:MAINTAINS {id: row.id}]->(p)
    `,
    {
      params: {
        rows,
      },
    },
  );
}