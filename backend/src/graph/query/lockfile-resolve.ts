import { hydraQuery } from "../../hydra/client";
import { cleanHydraRows } from "../../hydra/rows";

export interface LockfileEntry {
  name: string;
  version: string;
}

export interface LockfileResolutionResult {
  compromisedVersion: string;
  compromisedPackage: string;
  checkedEntries: number;
  resolvedToCompromised: number;
  matches: Array<{
    name: string;
    version: string;
    inGraph: boolean;
    services: Array<{
      serviceName: string;
      environment: string | null;
      hops: number;
    }>;
  }>;
}

interface MatchRow {
  entryName: unknown;
  entryVersion: unknown;
  inGraph: unknown;
  serviceName: unknown;
  environment: unknown;
  hops: unknown;
}

/**
 * Given a compromised version key and a list of lockfile entries,
 * check which entries resolved to the compromised version and
 * which services those entries belong to.
 *
 * This answers: "Which lockfiles resolved to the bad version
 * during the window it was live?"
 *
 * Graph pattern:
 *
 *   Check each entry against:
 *     (v:Version {key: "npm:<name>@<version>"})
 *     then trace back:
 *     (s:Service)-[:DEPENDS_ON_VERSION]->(v)-[:DEPENDS_ON*0..N]->(compromised:Version)
 */
export async function resolveLockfileEntries(
  compromisedVersionKey: string,
  entries: LockfileEntry[],
): Promise<LockfileResolutionResult> {
  // 1. Check if the compromised version exists in the graph
  const compromisedCheck = await hydraQuery(
    `
      MATCH (v:Version {key: $key})
      RETURN v.key AS key, v.packageName AS packageName
    `,
    {
      params: { key: compromisedVersionKey },
    },
  );

  if (compromisedCheck.rows.length === 0) {
    throw new Error(
      `Version not found: ${compromisedVersionKey}`,
    );
  }

  const compromisedRow = cleanHydraRows<{ key: unknown; packageName: unknown }>(
    ["key", "packageName"],
    compromisedCheck.rows,
  )[0];

  const compromisedPackageName = String(compromisedRow.packageName);

  // 2. Find the compromised version's ID for BFS
  const compromisedIdResult = await hydraQuery(
    `
      MATCH (v:Version {key: $key})
      RETURN v.id AS id
    `,
    { params: { key: compromisedVersionKey } },
  );

  if (compromisedIdResult.rows.length === 0) {
    throw new Error(
      `Version not found: ${compromisedVersionKey}`,
    );
  }

  const compromisedId = Number(
    compromisedIdResult.rows[0][0]?.value,
  );

  // 3. Load all service → version relationships
  const serviceVersionsResult = await hydraQuery(
    `
      MATCH (s:Service)-[:DEPENDS_ON_VERSION]->(v:Version)
      RETURN s.id AS serviceId, v.id AS versionId
    `,
    { params: {} },
  );

  const serviceVersionRows = cleanHydraRows<{
    serviceId: unknown;
    versionId: unknown;
  }>(["serviceId", "versionId"], serviceVersionsResult.rows);

  // 4. Load service metadata
  const serviceMetaResult = await hydraQuery(
    `
      MATCH (s:Service)
      RETURN s.id AS id, s.name AS name, s.environment AS environment
    `,
    { params: {} },
  );

  const serviceMetaRows = cleanHydraRows<{
    id: unknown;
    name: unknown;
    environment: unknown;
  }>(["id", "name", "environment"], serviceMetaResult.rows);

  const serviceMeta = new Map<
    number,
    { name: string; environment: string | null }
  >();

  for (const row of serviceMetaRows) {
    serviceMeta.set(Number(row.id), {
      name: String(row.name),
      environment:
        row.environment == null ? null : String(row.environment),
    });
  }

  // 5. For each lockfile entry, check if it reaches the compromised version
  const matches: LockfileResolutionResult["matches"] = [];

  for (const entry of entries) {
    const entryKey = `npm:${entry.name}@${entry.version}`;

    // Check if this version exists in the graph
    const entryExists = await hydraQuery(
      `
        MATCH (v:Version {key: $key})
        RETURN v.id AS id
      `,
      { params: { key: entryKey } },
    );

    if (entryExists.rows.length === 0) {
      matches.push({
        name: entry.name,
        version: entry.version,
        inGraph: false,
        services: [],
      });
      continue;
    }

    // BFS from this version to see if it reaches the compromised version
    const entryId = Number(entryExists.rows[0][0]?.value);

    // Find services that directly depend on this version
    const entryServices = serviceVersionRows.filter(
      (sv) => Number(sv.versionId) === entryId,
    );

    // BFS from entry version to check if it reaches the compromised version
    const affectedServices: Array<{
      serviceName: string;
      environment: string | null;
      hops: number;
    }> = [];

    for (const sv of entryServices) {
      const serviceId = Number(sv.serviceId);
      const meta = serviceMeta.get(serviceId);
      if (!meta) continue;

      // Application-level BFS from entry to compromised
      const visited = new Set<string>();
      let frontier = new Map<string, number>();
      frontier.set(String(entryId), 0);
      let found = false;
      let foundHops = 0;

      while (frontier.size > 0 && !found) {
        const next = new Map<string, number>();

        for (const [currentId, currentHops] of frontier) {
          if (visited.has(currentId)) continue;
          visited.add(currentId);

          if (Number(currentId) === compromisedId) {
            found = true;
            foundHops = currentHops;
            break;
          }

          if (currentHops >= 5) continue;

          // Get dependencies of current version
          const depResult = await hydraQuery(
            `
              MATCH (v:Version {id: $vid})-[:DEPENDS_ON]->(d:Version)
              RETURN d.id AS id
            `,
            { params: { vid: Number(currentId) } },
          );

          for (const row of depResult.rows) {
            const depId = String(row[0]?.value);
            if (depId && !visited.has(depId)) {
              next.set(depId, currentHops + 1);
            }
          }
        }

        frontier = next;
      }

      if (found) {
        affectedServices.push({
          serviceName: meta.name,
          environment: meta.environment,
          hops: foundHops,
        });
      }
    }

    matches.push({
      name: entry.name,
      version: entry.version,
      inGraph: true,
      services: affectedServices,
    });
  }

  const resolvedCount = matches.filter(
    (m) => m.services.length > 0,
  ).length;

  return {
    compromisedVersion: compromisedVersionKey,
    compromisedPackage: compromisedPackageName,
    checkedEntries: entries.length,
    resolvedToCompromised: resolvedCount,
    matches,
  };
}
