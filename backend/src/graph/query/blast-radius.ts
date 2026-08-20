import { hydraQuery } from "../../hydra/client";
import { cleanHydraRows } from "../../hydra/rows";

export interface BlastRadiusService {
  id: number;
  name: string;
  repo: string;
  team: string | null;
  environment: string | null;
  hops: number;
}

interface CompromisedVersionRow {
  id: unknown;
  key: unknown;
  packageName: unknown;
  version: unknown;
}

interface ServiceVersionRow {
  serviceId: unknown;
  versionId: unknown;
}

interface ServiceMetadataRow {
  id: unknown;
  name: unknown;
  repo: unknown;
  team: unknown;
  environment: unknown;
}

interface DependencyRow {
  id: unknown;
}

interface FrontierState {
  serviceId: number;
  versionId: number;
  hops: number;
}

export async function getBlastRadius(
  versionKey: string,
  maxDepth = 5,
): Promise<BlastRadiusService[]> {
  if (maxDepth < 0) {
    throw new Error("maxDepth must be >= 0");
  }

  /*
   * ---------------------------------------------------------
   * 1. Find compromised version
   * ---------------------------------------------------------
   */

  const compromised = await hydraQuery(
    `
      MATCH (v:Version {key: $key})

      RETURN
        v.id AS id,
        v.key AS key,
        v.packageName AS packageName,
        v.version AS version
    `,
    {
      params: {
        key: versionKey,
      },
    },
  );

  const compromisedRows =
    cleanHydraRows<CompromisedVersionRow>(
      [
        "id",
        "key",
        "packageName",
        "version",
      ],
      compromised.rows,
    );

  if (compromisedRows.length === 0) {
    throw new Error(
      `Version not found: ${versionKey}`,
    );
  }

  const compromisedId =
    Number(compromisedRows[0].id);

  /*
   * ---------------------------------------------------------
   * 2. Load all Service -> Version relationships
   * ---------------------------------------------------------
   *
   * Service
   *    |
   *    └── DEPENDS_ON_VERSION
   *              |
   *              ▼
   *           Version
   */

  const serviceVersionsResult =
    await hydraQuery(
      `
        MATCH
          (s:Service)-[:DEPENDS_ON_VERSION]->(v:Version)

        RETURN
          s.id AS serviceId,
          v.id AS versionId
      `,
      {
        params: {},
      },
    );

  const serviceVersionRows =
    cleanHydraRows<ServiceVersionRow>(
      [
        "serviceId",
        "versionId",
      ],
      serviceVersionsResult.rows,
    );

  /*
   * ---------------------------------------------------------
   * 3. Load service metadata
   * ---------------------------------------------------------
   */

  const serviceMetadataResult =
    await hydraQuery(
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

  const serviceMetadata =
    cleanHydraRows<ServiceMetadataRow>(
      [
        "id",
        "name",
        "repo",
        "team",
        "environment",
      ],
      serviceMetadataResult.rows,
    );

  const serviceById =
    new Map<number, ServiceMetadataRow>();

  for (const service of serviceMetadata) {
    serviceById.set(
      Number(service.id),
      service,
    );
  }

  /*
   * ---------------------------------------------------------
   * 4. Result set
   * ---------------------------------------------------------
   */

  const result =
    new Map<number, BlastRadiusService>();

  /*
   * ---------------------------------------------------------
   * 5. Initial BFS frontier
   * ---------------------------------------------------------
   *
   * Every service's lockfile/manifest resolution gives us
   * a concrete Version.
   *
   * Service
   *    |
   *    └── Version A
   *
   * We then walk:
   *
   * Version A
   *    |
   *    └── DEPENDS_ON -> Version B
   *                         |
   *                         └── ...
   *
   * until we hit the compromised version.
   */

  let frontier =
    new Map<string, FrontierState>();

  for (const row of serviceVersionRows) {
    const serviceId =
      Number(row.serviceId);

    const versionId =
      Number(row.versionId);

    const stateKey =
      `${serviceId}:${versionId}`;

    frontier.set(
      stateKey,
      {
        serviceId,
        versionId,
        hops: 0,
      },
    );
  }

  /*
   * ---------------------------------------------------------
   * 6. BFS traversal
   * ---------------------------------------------------------
   */

  const visited =
    new Set<string>();

  const MAX_QUERIES = 500;
  let queryCount = 0;

  while (
    frontier.size > 0 &&
    queryCount < MAX_QUERIES
  ) {
    const next =
      new Map<string, FrontierState>();

    for (const state of frontier.values()) {
      const stateKey =
        `${state.serviceId}:${state.versionId}`;

      if (visited.has(stateKey)) {
        continue;
      }

      visited.add(stateKey);

      /*
       * Direct dependency:
       *
       * Service -> compromised Version
       */

      if (
        state.versionId === compromisedId
      ) {
        const service =
          serviceById.get(state.serviceId);

        if (!service) {
          continue;
        }

        /*
         * If this service was already discovered
         * through a shorter path, keep the shorter path.
         */

        const existing =
          result.get(state.serviceId);

        if (
          !existing ||
          state.hops < existing.hops
        ) {
          result.set(
            state.serviceId,
            {
              id: state.serviceId,
              name: String(service.name),
              repo: String(service.repo),
              team:
                service.team == null
                  ? null
                  : String(service.team),
              environment:
                service.environment == null
                  ? null
                  : String(
                      service.environment,
                    ),
              hops: state.hops,
            },
          );
        }

        continue;
      }

      /*
       * Stop expanding once we reach maxDepth.
       */

      if (state.hops >= maxDepth) {
        continue;
      }

      /*
       * Find dependencies of current Version.
       */

      const dependenciesResult =
        await hydraQuery(
          `
            MATCH
              (v:Version {id: $versionId})
                -[:DEPENDS_ON]->
              (d:Version)

            RETURN
              d.id AS id
          `,
          {
            params: {
              versionId:
                state.versionId,
            },
          },
        );

      queryCount += 1;

      const dependencies =
        cleanHydraRows<DependencyRow>(
          ["id"],
          dependenciesResult.rows,
        );

      for (const dependency of dependencies) {
        const dependencyId =
          Number(dependency.id);

        const nextHops =
          state.hops + 1;

        const nextKey =
          `${state.serviceId}:${dependencyId}`;

        /*
         * If we directly reach the compromised
         * version, record the service immediately.
         */

        if (
          dependencyId === compromisedId
        ) {
          const service =
            serviceById.get(
              state.serviceId,
            );

          if (!service) {
            continue;
          }

          const existing =
            result.get(
              state.serviceId,
            );

          if (
            !existing ||
            nextHops < existing.hops
          ) {
            result.set(
              state.serviceId,
              {
                id: state.serviceId,
                name: String(service.name),
                repo: String(service.repo),
                team:
                  service.team == null
                    ? null
                    : String(service.team),
                environment:
                  service.environment == null
                    ? null
                    : String(
                        service.environment,
                      ),
                hops: nextHops,
              },
            );
          }

          continue;
        }

        /*
         * Continue BFS.
         */

        if (!visited.has(nextKey)) {
          next.set(
            nextKey,
            {
              serviceId:
                state.serviceId,
              versionId:
                dependencyId,
              hops: nextHops,
            },
          );
        }
      }
    }

    frontier = next;
  }

  /*
   * ---------------------------------------------------------
   * 7. Return shortest-path results
   * ---------------------------------------------------------
   */

  return Array.from(
    result.values(),
  ).sort(
    (a, b) =>
      a.hops - b.hops ||
      a.name.localeCompare(b.name),
  );
}