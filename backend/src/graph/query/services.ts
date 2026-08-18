import { hydraQuery } from "../../hydra/client";
import { cleanHydraRows } from "../../hydra/rows";

export interface ServiceVertex {
  id: number;
  name: string;
  repo: string;
  team?: string;
  environment?: string;
}

export interface ServiceDependencyEdge {
  id: number;
  serviceId: number;
  versionId: number;
}

export interface ServiceRow {
  id: number;
  name: string;
  repo: string;
  team: string | null;
  environment: string | null;
}

interface HydraServiceRow {
  id: unknown;
  name: unknown;
  repo: unknown;
  team: unknown;
  environment: unknown;
}

export async function upsertServices(
  services: ServiceVertex[],
): Promise<void> {
  if (services.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row

    MERGE (n {id: row.vertex})

    SET n:Service,
        n.name = row.name,
        n.repo = row.repo,
        n.team = row.team,
        n.environment = row.environment
  `;

  await hydraQuery(query, {
    params: {
      rows: services.map((service) => ({
        vertex: service.id,
        name: service.name,
        repo: service.repo,
        team: service.team ?? null,
        environment: service.environment ?? null,
      })),
    },
  });
}

export async function createServiceDependencyEdges(
  edges: ServiceDependencyEdge[],
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row

    MATCH
      (s:Service {id: row.serviceId}),
      (v:Version {id: row.versionId})

    CREATE
      (s)-[:DEPENDS_ON_VERSION {id: row.id}]->(v)
  `;

  await hydraQuery(query, {
    params: {
      rows: edges,
    },
  });
}

export async function getServices(): Promise<ServiceRow[]> {
  const result = await hydraQuery(
    `
      MATCH (s:Service)

      RETURN
        s.id AS id,
        s.name AS name,
        s.repo AS repo,
        s.team AS team,
        s.environment AS environment
    `,
    {
      params: {},
    },
  );

  const rows = cleanHydraRows<HydraServiceRow>(
    [
      "id",
      "name",
      "repo",
      "team",
      "environment",
    ],
    result.rows,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    repo: String(row.repo),
    team:
      row.team == null
        ? null
        : String(row.team),
    environment:
      row.environment == null
        ? null
        : String(row.environment),
  }));
}