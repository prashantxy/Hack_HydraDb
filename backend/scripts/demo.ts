/**
 * ChainTrace — one-command end-to-end demo
 *
 * Simulates a supply-chain incident from scratch:
 *
 *   1. Preflight check against HydraDB
 *   2. Ingest a real npm dependency chain (axios@1.7.2, depth 2)
 *   3. Register internal services that depend on it
 *   4. Simulate a compromise of a transitive dependency
 *   5. Answer the incident questions:
 *        - which services are transitively exposed (blast radius)
 *        - how the compromise reaches each service (attack paths)
 *        - overall risk score / severity
 *        - typosquat packages nearby
 *        - which lockfile entries resolved to the bad version
 *          while it was live (publish-time window)
 *
 * Usage:
 *   bun run demo
 *   bun run demo -- --package lodash --version 4.17.21 --depth 1
 */

import { ingestPackage } from "../src/npm/ingest";
import {
  upsertServices,
  createServiceDependencyEdges,
  type ServiceVertex,
  type ServiceDependencyEdge,
} from "../src/graph/query/services";
import { getBlastRadius } from "../src/graph/query/blast-radius";
import { getAttackPaths } from "../src/graph/query/attack-path";
import { getPackageRisk } from "../src/graph/query/risk";
import { detectTyposquats } from "../src/graph/query/typosquat";
import { resolveLockfileEntries } from "../src/graph/query/lockfile-resolve";
import { hydraQuery } from "../src/hydra/client";

// ── CLI args ──────────────────────────────────────────────────

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const rootPackage = argValue("--package") ?? "axios";
const rootVersion = argValue("--version") ?? "1.7.2";
const maxDepth = Number(argValue("--depth") ?? 2);

if (!Number.isInteger(maxDepth) || maxDepth < 0) {
  throw new Error(`Invalid depth: ${maxDepth}`);
}

/*
 * The "compromised" package: a transitive dep of the root.
 * For axios@1.7.2 this is form-data@4.0.6 (pulled via
 * axios -> form-data). Adjust here if you change the root.
 */
const compromisedPackage =
  argValue("--compromised") ?? "form-data";

// ── Deterministic IDs (must match ingestion) ──────────────────

function stableNumericId(key: string): number {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) + 1;
}

function npmVersionId(
  packageName: string,
  version: string,
): number {
  return stableNumericId(
    `version:npm:${packageName}@${version}`,
  );
}

// ── Demo services ─────────────────────────────────────────────

const services: ServiceVertex[] = [
  {
    id: stableNumericId("service:payment-api"),
    name: "payment-api",
    repo: "company/payment-api",
    team: "payments",
    environment: "production",
  },
  {
    id: stableNumericId("service:checkout-service"),
    name: "checkout-service",
    repo: "company/checkout-service",
    team: "commerce",
    environment: "production",
  },
  {
    id: stableNumericId("service:analytics-api"),
    name: "analytics-api",
    repo: "company/analytics-api",
    team: "data",
    environment: "staging",
  },
];

function serviceDependencyEdges(
  deps: Array<{
    service: string;
    packageName: string;
    version: string;
  }>,
): ServiceDependencyEdge[] {
  return deps.map((dep) => ({
    id: stableNumericId(
      `service:${dep.service}->npm:${dep.packageName}@${dep.version}`,
    ),
    serviceId: stableNumericId(`service:${dep.service}`),
    versionId: npmVersionId(dep.packageName, dep.version),
  }));
}

// ── Output helpers ────────────────────────────────────────────

function banner(title: string): void {
  console.log("");
  console.log("══════════════════════════════════════════");
  console.log(`  ${title}`);
  console.log("══════════════════════════════════════════");
}

function step(message: string): void {
  console.log(`\n▸ ${message}`);
}

// ── Demo ──────────────────────────────────────────────────────

banner("CHAINTRACE INCIDENT DEMO");

/*
 * STEP 0 — preflight
 */

step("Preflight: checking HydraDB connectivity...");

try {
  await hydraQuery(
    `MATCH (p:Package) RETURN p.id AS id LIMIT 1`,
    { params: {} },
  );
  console.log("  ✓ HydraDB reachable");
} catch (error) {
  console.error(
    "  ✗ Cannot reach HydraDB. Is it running on HYDRA_URL with a valid HYDRA_TOKEN?",
  );
  console.error(
    "    Start it with docker run (see README), then re-run this demo.",
  );
  throw error;
}

/*
 * STEP 1 — ingest the dependency chain
 */

step(
  `Ingesting npm:${rootPackage}@${rootVersion} ` +
  `(depth ${maxDepth})...`,
);

await ingestPackage({
  packageName: rootPackage,
  version: rootVersion,
  maxDepth,
  concurrency: 5,
});

console.log(
  `  ✓ Graph populated from the live npm registry`,
);

/*
 * STEP 2 — locate the compromised version in the graph
 *
 * The compromised package is a transitive dependency of the
 * root; find the concrete version the resolver pinned during
 * ingestion (BFS over DEPENDS_ON edges).
 */

async function findVersionInGraph(
  rootKey: string,
  packageName: string,
  maxHops: number,
): Promise<string | null> {
  let frontier = new Set<string>([rootKey]);
  const visited = new Set<string>(frontier);

  for (let hop = 0; hop < maxHops && frontier.size > 0; hop++) {
    const next = new Set<string>();

    for (const key of frontier) {
      const result = await hydraQuery(
        `
          MATCH (v:Version {key: $key})-[:DEPENDS_ON]->(d:Version)
          RETURN d.key AS key, d.packageName AS packageName
        `,
        { params: { key } },
      );

      for (const row of result.rows) {
        const depKey = String(row[0]?.value ?? "");
        const depName = String(row[1]?.value ?? "");

        if (!depKey || visited.has(depKey)) {
          continue;
        }

        if (depName === packageName) {
          return depKey;
        }

        visited.add(depKey);
        next.add(depKey);
      }
    }

    frontier = next;
  }

  return null;
}

step(
  `Locating ${compromisedPackage} in the dependency graph...`,
);

const compromisedKey = await findVersionInGraph(
  `npm:${rootPackage}@${rootVersion}`,
  compromisedPackage,
  maxDepth + 1,
);

if (!compromisedKey) {
  throw new Error(
    `${compromisedPackage} was not reached from ` +
    `${rootPackage}@${rootVersion} within ${maxDepth + 1} hops. ` +
    `Try a larger --depth or a different --compromised package.`,
  );
}

console.log(`  ✓ Compromised version: ${compromisedKey}`);

const [compromisedName, compromisedVersion] =
  compromisedKey.replace(/^npm:/, "").split("@");

/*
 * STEP 3 — register internal services
 */

step("Registering internal services...");

await upsertServices(services);

await createServiceDependencyEdges(
  serviceDependencyEdges([
    {
      service: "payment-api",
      packageName: rootPackage,
      version: rootVersion,
    },
    {
      service: "checkout-service",
      packageName: compromisedName,
      version: compromisedVersion,
    },
    {
      service: "analytics-api",
      packageName: compromisedName,
      version: compromisedVersion,
    },
  ]),
);

console.log(
  `  ✓ payment-api, checkout-service, analytics-api registered`,
);

/*
 * STEP 4 — the incident begins
 */

banner(
  `🚨 INCIDENT: ${compromisedName} COMPROMISED`,
);

console.log(`
  09:00  malicious publish detected for ${compromisedPackage}
  09:01  ChainTrace ingested the poisoned release
  09:02  blast radius computed across the service graph
`);

/*
 * STEP 4 — blast radius
 */

step("Computing blast radius...");

const blastRadius = await getBlastRadius(
  compromisedKey,
  maxDepth + 3,
);

console.log(
  `  Affected services: ${blastRadius.length}`,
);

for (const service of blastRadius) {
  console.log(
    `    • ${service.name} ` +
    `[${service.environment ?? "unknown"}] ` +
    `— ${service.hops} hop${service.hops === 1 ? "" : "s"} away`,
  );
}

/*
 * STEP 5 — attack paths
 */

step("Tracing attack paths...");

const attackPaths = await getAttackPaths(
  compromisedKey,
  maxDepth + 3,
);

for (const path of attackPaths) {
  console.log(
    `    • ${path.serviceName} ← ${path.path.join(" ← ")}`,
  );
}

/*
 * STEP 6 — risk score
 */

step("Scoring risk...");

const risk = await getPackageRisk(
  compromisedKey,
  maxDepth + 3,
);

console.log(
  `  Severity: ${risk.severity}  ` +
  `(score ${risk.score}/100)`,
);

console.log(
  `  Production services affected: ${risk.productionServices}` +
  ` / ${risk.affectedServices}`,
);

for (const service of risk.services) {
  console.log(
    `    • ${service.name}: ${service.score}/100 ` +
    `[${service.severity}]`,
  );

  for (const reason of service.reasons) {
    console.log(`        – ${reason}`);
  }
}

/*
 * STEP 7 — typosquats nearby
 */

step(
  `Scanning for typosquats near "${compromisedPackage}"...`,
);

const typosquats = await detectTyposquats(
  compromisedPackage,
  2,
);

console.log(
  `  Candidates within edit distance ${typosquats.threshold}: ` +
  `${typosquats.candidates.length}`,
);

for (const candidate of typosquats.candidates.slice(0, 5)) {
  console.log(
    `    • ${candidate.packageName} ` +
    `(distance ${candidate.editDistance}, ` +
    `popularity ${candidate.popularity}) — ` +
    `${candidate.riskSignal}`,
  );
}

/*
 * STEP 8 — lockfiles that resolved to the bad version while live
 */

step(
  "Resolving lockfile entries against the compromise window...",
);

const lockfileResult = await resolveLockfileEntries(
  compromisedKey,
  [
    {
      name: compromisedName,
      version: compromisedVersion,
    },
    { name: rootPackage, version: rootVersion },
  ],
);

console.log(
  `  Compromise window: ` +
  `${lockfileResult.window.start} → ` +
  `${lockfileResult.window.end ?? "now"} ` +
  `(${lockfileResult.window.source})`,
);

for (const match of lockfileResult.matches) {
  const windowLabel =
    match.resolvedDuringWindow == null
      ? "unknown"
      : match.resolvedDuringWindow
        ? "LIVE-WINDOW MATCH"
        : "outside window";

  console.log(
    `    • ${match.name}@${match.version} — ` +
    `${windowLabel}` +
    (match.services.length > 0
      ? `, ${match.services.length} service(s) exposed`
      : ""),
  );

  for (const service of match.services) {
    console.log(
      `        – ${service.serviceName} ` +
      `[${service.environment ?? "unknown"}] ` +
      `(${service.hops} hop${service.hops === 1 ? "" : "s"})`,
    );
  }
}

/*
 * Wrap-up
 */

banner("DEMO COMPLETE");

console.log(`
  Open the console for the visual view:
    cd front-end && npm run dev
    → http://localhost:3000/console/blast
`);
