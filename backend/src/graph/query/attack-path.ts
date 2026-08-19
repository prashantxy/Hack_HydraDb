import { hydraQuery } from "../../hydra/client";
import { cleanHydraRows } from "../../hydra/rows";

export interface AttackPath {
  serviceId: number;
  serviceName: string;
  environment: string | null;
  hops: number;
  path: string[];
}

interface VersionRow {
  id: unknown;
  key: unknown;
}

interface ServiceVersionRow {
  serviceId: unknown;
  versionId: unknown;
  versionKey: unknown;
}

interface ServiceRow {
  id: unknown;
  name: unknown;
  environment: unknown;
}

interface DependencyRow {
  id: unknown;
  key: unknown;
}

interface FrontierState {
  serviceId: number;
  versionId: number;
  hops: number;
  path: string[];
}

export async function getAttackPaths(
  versionKey: string,
  maxDepth = 5,
): Promise<AttackPath[]> {
  if (maxDepth < 0) {
    throw new Error(
      "maxDepth must be >= 0",
    );
  }

  /*
   * ==========================================================
   * 1. FIND COMPROMISED VERSION
   * ==========================================================
   */

  const versionResult =
    await hydraQuery(
      `
        MATCH (v:Version {key: $key})

        RETURN
          v.id AS id,
          v.key AS key
      `,
      {
        params: {
          key: versionKey,
        },
      },
    );

  const versionRows =
    cleanHydraRows<VersionRow>(
      ["id", "key"],
      versionResult.rows,
    );

  if (versionRows.length === 0) {
    throw new Error(
      `Version not found: ${versionKey}`,
    );
  }

  const compromisedId =
    Number(versionRows[0].id);

  /*
   * ==========================================================
   * 2. LOAD SERVICE -> VERSION RELATIONSHIPS
   * ==========================================================
   *
   * Service
   *    |
   *    v
   * Version
   *
   * We also load versionKey here so we don't need
   * another query for every service/version pair.
   */

  const serviceVersionResult =
    await hydraQuery(
      `
        MATCH
          (s:Service)-[:DEPENDS_ON_VERSION]->(v:Version)

        RETURN
          s.id AS serviceId,
          v.id AS versionId,
          v.key AS versionKey
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
        "versionKey",
      ],
      serviceVersionResult.rows,
    );

  /*
   * ==========================================================
   * 3. LOAD SERVICE METADATA
   * ==========================================================
   */

  const serviceResult =
    await hydraQuery(
      `
        MATCH (s:Service)

        RETURN
          s.id AS id,
          s.name AS name,
          s.environment AS environment
      `,
      {
        params: {},
      },
    );

  const serviceRows =
    cleanHydraRows<ServiceRow>(
      [
        "id",
        "name",
        "environment",
      ],
      serviceResult.rows,
    );

  const serviceById =
    new Map<number, ServiceRow>();

  for (const service of serviceRows) {
    serviceById.set(
      Number(service.id),
      service,
    );
  }

  /*
   * ==========================================================
   * 4. INITIAL BFS FRONTIER
   * ==========================================================
   *
   * Service
   *    |
   *    v
   * Version A
   *
   * Path:
   *
   * [
   *   "npm:package@version"
   * ]
   */

  let frontier =
    new Map<string, FrontierState>();

  for (
    const row
    of serviceVersionRows
  ) {
    const serviceId =
      Number(row.serviceId);

    const startVersionId =
      Number(row.versionId);

    const startVersionKey =
      String(row.versionKey);

    /*
     * Make sure the service exists.
     */

    if (
      !serviceById.has(serviceId)
    ) {
      continue;
    }

    const stateKey =
      `${serviceId}:${startVersionId}`;

    frontier.set(
      stateKey,
      {
        serviceId,
        versionId:
          startVersionId,
        hops: 0,
        path: [
          startVersionKey,
        ],
      },
    );
  }

  /*
   * ==========================================================
   * 5. BFS STATE
   * ==========================================================
   */

  const visited =
    new Set<string>();

  const results =
    new Map<number, AttackPath>();

  /*
   * ==========================================================
   * 6. BFS TRAVERSAL
   * ==========================================================
   */

  while (
    frontier.size > 0
  ) {
    const next =
      new Map<string, FrontierState>();

    for (
      const state
      of frontier.values()
    ) {
      const stateKey =
        `${state.serviceId}:${state.versionId}`;

      /*
       * Prevent cycles.
       */

      if (
        visited.has(stateKey)
      ) {
        continue;
      }

      visited.add(stateKey);

      /*
       * ------------------------------------------------------
       * COMPROMISED VERSION REACHED
       * ------------------------------------------------------
       *
       * Example:
       *
       * payment-api
       *      |
       *      v
       * npm:axios@1.7.2
       */

      if (
        state.versionId ===
        compromisedId
      ) {
        const service =
          serviceById.get(
            state.serviceId,
          );

        if (!service) {
          continue;
        }

        const existing =
          results.get(
            state.serviceId,
          );

        /*
         * Keep shortest path.
         */

        if (
          !existing ||
          state.hops < existing.hops
        ) {
          results.set(
            state.serviceId,
            {
              serviceId:
                state.serviceId,

              serviceName:
                String(
                  service.name,
                ),

              environment:
                service.environment == null
                  ? null
                  : String(
                      service.environment,
                    ),

              hops:
                state.hops,

              path:
                [...state.path],
            },
          );
        }

        continue;
      }

      /*
       * ------------------------------------------------------
       * DEPTH LIMIT
       * ------------------------------------------------------
       */

      if (
        state.hops >= maxDepth
      ) {
        continue;
      }

      /*
       * ------------------------------------------------------
       * FIND VERSION DEPENDENCIES
       * ------------------------------------------------------
       *
       * Current Version
       *       |
       *       v
       * Dependency Version
       */

      const dependencyResult =
        await hydraQuery(
          `
            MATCH
              (v:Version {id: $versionId})
                -[:DEPENDS_ON]->
              (d:Version)

            RETURN
              d.id AS id,
              d.key AS key
          `,
          {
            params: {
              versionId:
                state.versionId,
            },
          },
        );

      const dependencies =
        cleanHydraRows<DependencyRow>(
          [
            "id",
            "key",
          ],
          dependencyResult.rows,
        );

      /*
       * ------------------------------------------------------
       * EXPAND DEPENDENCIES
       * ------------------------------------------------------
       */

      for (
        const dependency
        of dependencies
      ) {
        const dependencyId =
          Number(
            dependency.id,
          );

        const dependencyKey =
          String(
            dependency.key,
          );

        const nextHops =
          state.hops + 1;

        const nextStateKey =
          `${state.serviceId}:${dependencyId}`;

        /*
         * Build complete path.
         *
         * Example:
         *
         * [
         *   "npm:foo@1.0.0",
         *   "npm:bar@2.0.0",
         *   "npm:axios@1.7.2"
         * ]
         */

        const nextPath = [
          ...state.path,
          dependencyKey,
        ];

        /*
         * ----------------------------------------------------
         * COMPROMISED VERSION FOUND
         * ----------------------------------------------------
         */

        if (
          dependencyId ===
          compromisedId
        ) {
          const service =
            serviceById.get(
              state.serviceId,
            );

          if (!service) {
            continue;
          }

          const existing =
            results.get(
              state.serviceId,
            );

          if (
            !existing ||
            nextHops < existing.hops
          ) {
            results.set(
              state.serviceId,
              {
                serviceId:
                  state.serviceId,

                serviceName:
                  String(
                    service.name,
                  ),

                environment:
                  service.environment == null
                    ? null
                    : String(
                        service.environment,
                      ),

                hops:
                  nextHops,

                path:
                  nextPath,
              },
            );
          }

          continue;
        }

        /*
         * ----------------------------------------------------
         * CONTINUE BFS
         * ----------------------------------------------------
         */

        if (
          !visited.has(
            nextStateKey,
          )
        ) {
          next.set(
            nextStateKey,
            {
              serviceId:
                state.serviceId,

              versionId:
                dependencyId,

              hops:
                nextHops,

              path:
                nextPath,
            },
          );
        }
      }
    }

    frontier = next;
  }

  /*
   * ==========================================================
   * 7. RETURN SHORTEST ATTACK PATHS
   * ==========================================================
   */

  return Array.from(
    results.values(),
  ).sort(
    (a, b) =>
      a.hops - b.hops ||
      a.serviceName.localeCompare(
        b.serviceName,
      ),
  );
}