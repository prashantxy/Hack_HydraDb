/*
 * Sample dataset, used only when the API is unreachable so the
 * console is still explorable. Everything here is shaped exactly
 * like the real responses, and the risk numbers are produced by a
 * port of backend/src/graph/query/risk.ts — so what you read in
 * demo mode is what the backend would return for the same graph.
 */

import {
  SEVERITY_ORDER,
  versionKey,
  type CoMaintainerPackage,
  type CoMaintainers,
  type LockfileEntry,
  type LockfileMatch,
  type LockfileResolve,
  type Popularity,
  type Typosquat,
  type TyposquatCandidate,
  type AttackPath,
  type AttackPaths,
  type BlastRadius,
  type BlastService,
  type GraphEdge,
  type GraphNode,
  type PackageGraph,
  type PackageRisk,
  type ServiceRisk,
  type ServiceRow,
  type Severity,
} from "./api";

/* ── a real express dependency tree ──────────────────────────── */

const VERSIONS: Record<string, string> = {
  /* axios and its real tree — the package the backend's own dataset
   * is seeded with, so the sample set mirrors the live one */
  axios: "1.7.2",
  "follow-redirects": "1.15.6",
  "form-data": "4.0.0",
  asynckit: "0.4.0",
  "delayed-stream": "1.0.0",
  "proxy-from-env": "1.1.0",

  express: "4.19.2",
  accepts: "1.3.8",
  "array-flatten": "1.1.1",
  "body-parser": "1.20.2",
  bytes: "3.1.2",
  "combined-stream": "1.0.8",
  "content-disposition": "0.5.4",
  "content-type": "1.0.5",
  cookie: "0.6.0",
  "cookie-signature": "1.0.6",
  debug: "2.6.9",
  depd: "2.0.0",
  destroy: "1.2.0",
  encodeurl: "1.0.2",
  "escape-html": "1.0.3",
  etag: "1.8.1",
  finalhandler: "1.2.0",
  forwarded: "0.2.0",
  fresh: "0.5.2",
  "http-errors": "2.0.0",
  "iconv-lite": "0.4.24",
  inherits: "2.0.4",
  "ipaddr.js": "1.9.1",
  "media-typer": "0.3.0",
  "merge-descriptors": "1.0.1",
  methods: "1.1.2",
  mime: "1.6.0",
  "mime-db": "1.52.0",
  "mime-types": "2.1.35",
  ms: "2.0.0",
  negotiator: "0.6.3",
  "on-finished": "2.4.1",
  parseurl: "1.3.3",
  "path-to-regexp": "0.1.7",
  "proxy-addr": "2.0.7",
  qs: "6.11.0",
  "range-parser": "1.2.1",
  "raw-body": "2.5.2",
  "safe-buffer": "5.2.1",
  "safer-buffer": "2.1.2",
  send: "0.18.0",
  "serve-static": "1.15.0",
  setprototypeof: "1.2.0",
  statuses: "2.0.1",
  toidentifier: "1.0.1",
  "type-is": "1.6.18",
  unpipe: "1.0.0",
  "utils-merge": "1.0.1",
  vary: "1.1.2",
};

/* name → its runtime dependencies */
const TREE: Record<string, string[]> = {
  axios: ["follow-redirects", "form-data", "proxy-from-env"],
  "form-data": ["asynckit", "combined-stream", "mime-types"],
  "combined-stream": ["delayed-stream"],

  express: [
    "accepts",
    "array-flatten",
    "body-parser",
    "content-disposition",
    "content-type",
    "cookie",
    "cookie-signature",
    "debug",
    "depd",
    "encodeurl",
    "escape-html",
    "etag",
    "finalhandler",
    "fresh",
    "http-errors",
    "merge-descriptors",
    "methods",
    "on-finished",
    "parseurl",
    "path-to-regexp",
    "proxy-addr",
    "qs",
    "range-parser",
    "safe-buffer",
    "send",
    "serve-static",
    "setprototypeof",
    "statuses",
    "type-is",
    "utils-merge",
    "vary",
  ],
  accepts: ["mime-types", "negotiator"],
  "body-parser": [
    "bytes",
    "content-type",
    "debug",
    "depd",
    "destroy",
    "http-errors",
    "iconv-lite",
    "on-finished",
    "qs",
    "raw-body",
    "type-is",
    "unpipe",
  ],
  "content-disposition": ["safe-buffer"],
  debug: ["ms"],
  finalhandler: [
    "debug",
    "encodeurl",
    "escape-html",
    "on-finished",
    "parseurl",
    "statuses",
    "unpipe",
  ],
  "http-errors": [
    "depd",
    "inherits",
    "setprototypeof",
    "statuses",
    "toidentifier",
  ],
  "iconv-lite": ["safer-buffer"],
  "mime-types": ["mime-db"],
  "proxy-addr": ["forwarded", "ipaddr.js"],
  "raw-body": ["bytes", "http-errors", "iconv-lite", "unpipe"],
  send: [
    "debug",
    "destroy",
    "encodeurl",
    "escape-html",
    "etag",
    "fresh",
    "http-errors",
    "mime",
    "ms",
    "on-finished",
    "range-parser",
    "statuses",
  ],
  "serve-static": ["encodeurl", "escape-html", "parseurl", "send"],
  "type-is": ["media-typer", "mime-types"],
  qs: ["safe-buffer"],
};

const RANGES: Record<string, string> = {
  "mime-types": "~2.1.34",
  negotiator: "0.6.3",
  ms: "2.0.0",
  "safe-buffer": "5.2.1",
  statuses: "2.0.1",
  depd: "2.0.0",
  "http-errors": "2.0.0",
  "iconv-lite": "0.4.24",
  send: "0.18.0",
  "mime-db": "1.52.0",
};

const key = (name: string) => versionKey(name, VERSIONS[name] ?? "0.0.0");

/* Level-by-level walk, exactly how graph-service.ts builds it: a
 * node is only visited once, and an edge carries the depth of its
 * target level. */
export function demoGraph(pkg: string, depth: number): PackageGraph {
  const root = TREE[pkg] ? pkg : "axios";
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const seen = new Set<string>([root]);

  nodes.set(key(root), {
    id: key(root),
    packageName: root,
    version: VERSIONS[root] ?? "0.0.0",
    depth: 0,
  });

  let frontier = [root];

  for (let d = 1; d <= depth; d++) {
    const next: string[] = [];

    for (const parent of frontier) {
      for (const child of TREE[parent] ?? []) {
        if (!VERSIONS[child]) continue;

        edges.push({
          source: key(parent),
          target: key(child),
          packageName: child,
          versionRange: RANGES[child] ?? `^${VERSIONS[child]}`,
          dependencyType: "runtime",
          depth: d,
        });

        if (!nodes.has(key(child))) {
          nodes.set(key(child), {
            id: key(child),
            packageName: child,
            version: VERSIONS[child],
            depth: d,
          });
        }

        if (!seen.has(child)) {
          seen.add(child);
          next.push(child);
        }
      }
    }

    frontier = next;
    if (frontier.length === 0) break;
  }

  return { package: root, depth, nodes: [...nodes.values()], edges };
}

/* ── services ────────────────────────────────────────────────── */

export const DEMO_SERVICES: (ServiceRow & { hops: number })[] = [
  {
    id: 1,
    name: "checkout-api",
    repo: "acme/checkout-api",
    team: "payments",
    environment: "production",
    hops: 1,
  },
  {
    id: 2,
    name: "billing-worker",
    repo: "acme/billing-worker",
    team: "payments",
    environment: "production",
    hops: 2,
  },
  {
    id: 3,
    name: "edge-gateway",
    repo: "acme/edge-gateway",
    team: "platform",
    environment: "production",
    hops: 0,
  },
  {
    id: 4,
    name: "docs-site",
    repo: "acme/docs-site",
    team: "growth",
    environment: "staging",
    hops: 3,
  },
  {
    id: 5,
    name: "admin-console",
    repo: "acme/admin-console",
    team: "internal-tools",
    environment: "development",
    hops: 4,
  },
];

export const DEMO_VERSION_KEY = key("axios");

export function demoBlastRadius(
  versionKeyIn = DEMO_VERSION_KEY,
  maxDepth = 5,
): BlastRadius {
  const services: BlastService[] = DEMO_SERVICES.filter(
    (s) => s.hops <= maxDepth,
  ).map(({ id, name, repo, team, environment, hops }) => ({
    id,
    name,
    repo,
    team,
    environment,
    hops,
  }));

  return {
    version: versionKeyIn,
    maxDepth,
    affectedServices: services.length,
    services,
  };
}

/* the chain each service takes to reach the compromised version */
const CHAINS: Record<string, string[]> = {
  "edge-gateway": ["axios"],
  "checkout-api": ["form-data", "axios"],
  "billing-worker": ["combined-stream", "form-data", "axios"],
  "docs-site": ["mime-types", "form-data", "axios"],
  "admin-console": ["delayed-stream", "combined-stream", "form-data", "axios"],
};

export function demoAttackPaths(
  versionKeyIn = DEMO_VERSION_KEY,
  maxDepth = 5,
): AttackPaths {
  const paths: AttackPath[] = DEMO_SERVICES.filter(
    (s) => s.hops <= maxDepth,
  ).map((s) => ({
    serviceId: s.id,
    serviceName: s.name,
    environment: s.environment,
    hops: s.hops,
    path: (CHAINS[s.name] ?? []).map(key),
  }));

  return {
    version: versionKeyIn,
    maxDepth,
    affectedServices: paths.length,
    attackPaths: paths,
  };
}

/* ── the scorer, ported from backend/src/graph/query/risk.ts ──── */

export function scoreService(service: {
  id: number;
  name: string;
  environment: string | null;
  hops: number;
}): ServiceRisk {
  let score = 0;
  const reasons: string[] = [];

  const env = service.environment?.toLowerCase();

  if (env === "production") {
    score += 60;
    reasons.push("Affected production service");
  } else if (env === "staging") {
    score += 30;
    reasons.push("Affected staging service");
  } else {
    score += 10;
    reasons.push("Non-production service affected");
  }

  if (service.hops === 0) {
    score += 30;
    reasons.push("Direct dependency");
  } else if (service.hops === 1) {
    score += 20;
    reasons.push("One-hop transitive dependency");
  } else if (service.hops <= 3) {
    score += 10;
    reasons.push(`${service.hops}-hop transitive dependency`);
  }

  score = Math.min(score, 100);

  return {
    serviceId: service.id,
    name: service.name,
    environment: service.environment,
    hops: service.hops,
    score,
    severity: severityOf(score),
    reasons,
  };
}

export function severityOf(score: number): Severity {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export function demoRisk(
  versionKeyIn = DEMO_VERSION_KEY,
  maxDepth = 5,
): PackageRisk {
  const services = demoBlastRadius(versionKeyIn, maxDepth).services.map(
    scoreService,
  );

  const productionServices = services.filter(
    (s) => s.environment?.toLowerCase() === "production",
  ).length;

  let score = services.length
    ? Math.max(...services.map((s) => s.score))
    : 0;

  if (productionServices >= 2) score += 10;
  if (productionServices >= 5) score += 10;
  score = Math.min(score, 100);

  return {
    version: versionKeyIn,
    score,
    severity: severityOf(score),
    affectedServices: services.length,
    productionServices,
    services: services.sort(
      (a, b) =>
        SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
        b.score - a.score,
    ),
    maxDepth,
  };
}

export const DEMO_PACKAGE = "axios";
export const DEMO_PACKAGE_VERSION = VERSIONS.axios;

/* ── co-maintainers ─────────────────────────────────────────────
 * (m:Maintainer)-[:MAINTAINS]->(:Package) shared with the queried
 * package. Sorted by shared count, then alphabetically, as the
 * endpoint does.
 */

export function demoCoMaintainers(
  versionKeyIn = DEMO_VERSION_KEY,
): CoMaintainers {
  const packages: CoMaintainerPackage[] = [
    {
      packageName: "follow-redirects",
      sharedMaintainers: ["jasonsaayman", "emilyemorehouse"],
      sharedCount: 2,
    },
    {
      packageName: "axios-mock-adapter",
      sharedMaintainers: ["jasonsaayman", "emilyemorehouse"],
      sharedCount: 2,
    },
    { packageName: "form-data", sharedMaintainers: ["jasonsaayman"], sharedCount: 1 },
    { packageName: "proxy-from-env", sharedMaintainers: ["jasonsaayman"], sharedCount: 1 },
  ].sort(
    (a, b) =>
      b.sharedCount - a.sharedCount ||
      a.packageName.localeCompare(b.packageName),
  );

  return {
    version: versionKeyIn,
    coMaintainerCount: packages.length,
    packages,
  };
}

/* ── typosquat ──────────────────────────────────────────────────
 * Levenshtein over the package names the graph knows, with the same
 * signals the endpoint reports.
 */

const KNOWN_NAMES = Object.keys(VERSIONS);

function levenshtein(a: string, b: string): number {
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const row = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = row[j];
  }

  return prev[b.length];
}

const POPULAR = new Set([
  "lodash",
  "react",
  "express",
  "axios",
  "debug",
  "qs",
  "send",
]);

function popularityOf(name: string): Popularity {
  if (POPULAR.has(name)) return "high";
  if (name.length <= 6) return "medium";
  if (name.length <= 12) return "low";
  return "unknown";
}

export function demoTyposquat(target: string, threshold = 2): Typosquat {
  /* a handful of plausible squats, so the view has something to show
   * even though the sample graph holds only legitimate names */
  const invented = [
    `${target}-js`,
    `${target}s`,
    target.slice(0, -1),
    target.replace(/[aeiou]/, ""),
    `node-${target}`,
  ];

  const pool = [...new Set([...KNOWN_NAMES, ...invented])].filter(
    (n) => n !== target,
  );

  const candidates: TyposquatCandidate[] = pool
    .map((packageName) => {
      const editDistance = levenshtein(target, packageName);
      const sharedPrefix = target.slice(0, 3) === packageName.slice(0, 3);
      const sharedSuffix = target.slice(-3) === packageName.slice(-3);

      const signal = [
        `Edit distance ${editDistance}`,
        sharedPrefix ? "shared prefix" : null,
        sharedSuffix ? "shared suffix" : null,
      ]
        .filter(Boolean)
        .join(" — ");

      return {
        packageName,
        editDistance,
        sharedPrefix,
        sharedSuffix,
        popularity: popularityOf(packageName),
        riskSignal: signal,
      };
    })
    .filter((c) => c.editDistance <= threshold && c.editDistance > 0)
    .sort(
      (a, b) =>
        a.editDistance - b.editDistance ||
        a.packageName.localeCompare(b.packageName),
    );

  return { targetPackage: target, threshold, candidates };
}

/* ── lockfile resolve ───────────────────────────────────────────
 * An entry "matches" when it is the compromised version itself or
 * its tree reaches it, and it is reachable from a service.
 */

export function demoLockfileResolve(
  compromisedVersion: string,
  entries: LockfileEntry[],
): LockfileResolve {
  const compromisedPackage = compromisedVersion
    .replace(/^(npm|pypi):/, "")
    .replace(/@[^@]*$/, "");

  const matches: LockfileMatch[] = entries.map((entry) => {
    const inGraph = Boolean(
      VERSIONS[entry.name] && VERSIONS[entry.name] === entry.version,
    );

    /* a chain touches the compromised package when the demo path for
     * some service runs through this entry */
    const reaching = inGraph
      ? DEMO_SERVICES.filter((s) => {
          const chain = CHAINS[s.name] ?? [];
          return (
            chain.includes(entry.name) && chain.includes(compromisedPackage)
          );
        })
      : [];

    return {
      name: entry.name,
      version: entry.version,
      inGraph,
      services: reaching.map((s) => ({
        serviceName: s.name,
        environment: s.environment,
        hops: Math.max(
          0,
          (CHAINS[s.name] ?? []).indexOf(compromisedPackage) -
            (CHAINS[s.name] ?? []).indexOf(entry.name),
        ),
      })),
    };
  });

  return {
    compromisedVersion,
    compromisedPackage,
    checkedEntries: entries.length,
    resolvedToCompromised: matches.filter((m) => m.services.length > 0).length,
    matches,
  };
}
