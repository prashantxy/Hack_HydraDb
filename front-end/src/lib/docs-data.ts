/*
 * Reference data for /docs.
 *
 * Transcribed from backend/API_DOCUMENTATION.md and
 * cli/CLI_DOCUMENTATION.md. Keeping it as data rather than prose
 * means the page renders one consistent shape for every endpoint,
 * and drift is a diff rather than a rewrite.
 */

export type Method = "GET" | "POST";

export interface Param {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  about: string;
}

export interface Endpoint {
  id: string;
  method: Method;
  path: string;
  summary: string;
  detail?: string;
  params?: Param[];
  body?: Param[];
  response?: string;
  errors?: [string, string][];
  curl: string;
  /* the console view that renders this endpoint */
  console?: { href: string; label: string };
  writes?: boolean;
}

export interface EndpointGroup {
  id: string;
  title: string;
  blurb: string;
  endpoints: Endpoint[];
}

/* ── the graph everything is asking about ─────────────────────── */

export const GRAPH_MODEL = `(:Package)  ──[:HAS_VERSION]──▶  (:Version)
(:Version)  ──[:DEPENDS_ON]───▶  (:Version)
(:Service)  ──[:DEPENDS_ON_VERSION]──▶  (:Version)
(:Maintainer) ──[:MAINTAINS]──▶  (:Package)`;

export const VERTICES: [string, string, string][] = [
  [
    "Package",
    "id · name · ecosystem",
    "One package name in one registry. npm and PyPI both land here.",
  ],
  [
    "Version",
    "id · key · packageName · version · ecosystem",
    "A concrete released version. The key is what every version-scoped endpoint takes.",
  ],
  [
    "Service",
    "id · name · repo · team · environment",
    "Something you deploy. Without these the graph knows packages but not consequences.",
  ],
  [
    "Maintainer",
    "id · username",
    "A publishing account. Written during ingest.",
  ],
];

export const EDGES: [string, string, string][] = [
  ["HAS_VERSION", "Package → Version", "Every released version of a package."],
  [
    "DEPENDS_ON",
    "Version → Version",
    "Carries the dependency type and the range that pulled it in.",
  ],
  [
    "DEPENDS_ON_VERSION",
    "Service → Version",
    "What a service actually ships. The edge that turns packages into impact.",
  ],
  ["MAINTAINS", "Maintainer → Package", "Who can publish to it."],
];

/* ── HTTP API ─────────────────────────────────────────────────── */

const DEPTH: Param = {
  name: "depth",
  type: "query · integer",
  default: "5",
  about: "Traversal depth. The API caps it at 5 — an unbounded walk over a real registry graph is not a query anyone should trigger by accident.",
};

export const API: EndpointGroup[] = [
  {
    id: "system",
    title: "System",
    blurb:
      "Liveness, and the service registry that every impact answer is ultimately counting.",
    endpoints: [
      {
        id: "health",
        method: "GET",
        path: "/health",
        summary: "Liveness check.",
        response: `{ "status": "ok" }`,
        curl: `curl "$CHAINTRACE_API/health"`,
      },
      {
        id: "services-get",
        method: "GET",
        path: "/services",
        summary: "Every registered service.",
        response: `{
  "success": true,
  "count": 1,
  "services": [
    {
      "id": 2076504302,
      "name": "payment-api",
      "repo": "acme/payment-api",
      "team": "payments",
      "environment": "production"
    }
  ]
}`,
        curl: `curl "$CHAINTRACE_API/services"`,
        console: { href: "/console/services", label: "Services" },
      },
      {
        id: "services-post",
        method: "POST",
        path: "/services",
        summary: "Register a service and the versions it ships.",
        detail:
          "This is the write that makes blast radius, attack paths and risk mean anything. Run it from your deploy pipeline, not by hand.",
        writes: true,
        body: [
          { name: "name", type: "string", required: true, about: "Service name." },
          { name: "repo", type: "string", about: "Source repository." },
          { name: "team", type: "string", about: "Owning team." },
          {
            name: "environment",
            type: "string",
            default: "development",
            about: "production, staging, or anything else. Drives 60 / 30 / 10 points of risk.",
          },
          {
            name: "dependencies",
            type: "{ name, version }[]",
            required: true,
            about: "Resolved versions this service depends on.",
          },
        ],
        response: `{ "success": true, "serviceId": 2076504302, "dependencyCount": 12 }`,
        curl: `curl -X POST "$CHAINTRACE_API/services" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "payment-api",
    "repo": "acme/payment-api",
    "team": "payments",
    "environment": "production",
    "dependencies": [{ "name": "axios", "version": "1.7.2" }]
  }'`,
      },
    ],
  },
  {
    id: "packages",
    title: "Packages",
    blurb: "Reading the dependency graph forwards, from a package outwards.",
    endpoints: [
      {
        id: "package",
        method: "GET",
        path: "/packages/:packageName",
        summary: "Package info and every version the graph knows.",
        params: [
          {
            name: "packageName",
            type: "path · string",
            required: true,
            about: "URL-encoded package name.",
          },
        ],
        response: `{
  "package": "axios",
  "versions": [{ "key": "npm:axios@1.7.2", "version": "1.7.2" }]
}`,
        errors: [["404", "Package not found in the graph"]],
        curl: `curl "$CHAINTRACE_API/packages/axios"`,
      },
      {
        id: "graph",
        method: "GET",
        path: "/packages/:packageName/graph",
        summary: "The dependency graph, level by level, with a hop depth on every node.",
        detail:
          "Traversal runs one level at a time rather than as a variable-length Cypher path, which is why each node and edge carries an explicit depth. Ask for depth 2 and you get depth 2.",
        params: [
          {
            name: "packageName",
            type: "path · string",
            required: true,
            about: "URL-encoded package name.",
          },
          { ...DEPTH, default: "1", about: "1–5. Levels of transitive dependencies to walk." },
        ],
        response: `{
  "package": "axios",
  "depth": 2,
  "nodes": [
    { "id": "npm:axios@1.7.2", "packageName": "axios", "version": "1.7.2", "depth": 0 },
    { "id": "npm:form-data@4.0.0", "packageName": "form-data", "version": "4.0.0", "depth": 1 }
  ],
  "edges": [
    {
      "source": "npm:axios@1.7.2",
      "target": "npm:form-data@4.0.0",
      "packageName": "form-data",
      "versionRange": "^4.0.0",
      "dependencyType": "runtime",
      "depth": 1
    }
  ]
}`,
        curl: `curl "$CHAINTRACE_API/packages/axios/graph?depth=2"`,
        console: { href: "/console/graph", label: "3D graph" },
      },
      {
        id: "analysis",
        method: "GET",
        path: "/packages/:packageName/:version/analysis",
        summary: "Risk, blast radius and attack paths in a single request.",
        detail:
          "The triage call. Everything the three dedicated endpoints return, for one version, in one round trip.",
        params: [
          { name: "packageName", type: "path · string", required: true, about: "Package name." },
          { name: "version", type: "path · string", required: true, about: "Exact version." },
          DEPTH,
        ],
        response: `{
  "packageName": "axios",
  "version": "1.7.2",
  "versionKey": "npm:axios@1.7.2",
  "risk": { "score": 100, "severity": "CRITICAL", "services": [ … ] },
  "blastRadius": { "affectedServices": 4, "productionServices": 3, "services": [ … ] },
  "attackPaths": { "affectedServices": 4, "paths": [ … ] },
  "maxDepth": 5
}`,
        curl: `curl "$CHAINTRACE_API/packages/axios/1.7.2/analysis?depth=5"`,
        console: { href: "/console/analysis", label: "Analysis" },
      },
      {
        id: "package-risk",
        method: "GET",
        path: "/packages/:packageName/:version/risk",
        summary: "Risk for a version, addressed by package and version instead of key.",
        params: [
          { name: "packageName", type: "path · string", required: true, about: "Package name." },
          { name: "version", type: "path · string", required: true, about: "Exact version." },
          DEPTH,
        ],
        response: `{ "version": "npm:axios@1.7.2", "score": 100, "severity": "CRITICAL", … }`,
        curl: `curl "$CHAINTRACE_API/packages/axios/1.7.2/risk"`,
        console: { href: "/console/risk", label: "Risk" },
      },
    ],
  },
  {
    id: "versions",
    title: "Versions",
    blurb:
      "Reading the graph backwards, from one compromised version to whoever is exposed to it. Every path here takes a full version key.",
    endpoints: [
      {
        id: "dependencies",
        method: "GET",
        path: "/versions/:versionKey/dependencies",
        summary: "Direct dependencies of one version.",
        params: [
          {
            name: "versionKey",
            type: "path · string",
            required: true,
            about: "URL-encoded key, e.g. npm:axios@1.7.2.",
          },
        ],
        response: `{
  "version": "npm:axios@1.7.2",
  "dependencies": [
    { "key": "npm:form-data@4.0.0", "packageName": "form-data", "version": "4.0.0" }
  ]
}`,
        curl: `curl "$CHAINTRACE_API/versions/npm:axios@1.7.2/dependencies"`,
      },
      {
        id: "blast-radius",
        method: "GET",
        path: "/versions/:versionKey/blast-radius",
        summary: "Which services reach this version, and from how many hops away.",
        detail:
          "Reverse DEPENDS_ON traversal. The hop count is the difference between an upgrade you schedule and one you page for.",
        params: [
          { name: "versionKey", type: "path · string", required: true, about: "URL-encoded version key." },
          DEPTH,
        ],
        response: `{
  "version": "npm:axios@1.7.2",
  "maxDepth": 5,
  "affectedServices": 1,
  "services": [
    {
      "id": 2076504302,
      "name": "payment-api",
      "repo": "acme/payment-api",
      "team": "payments",
      "environment": "production",
      "hops": 0
    }
  ]
}`,
        curl: `curl "$CHAINTRACE_API/versions/npm:axios@1.7.2/blast-radius?depth=5"`,
        console: { href: "/console/blast", label: "Blast radius" },
      },
      {
        id: "attack-path",
        method: "GET",
        path: "/versions/:versionKey/attack-path",
        summary: "The shortest chain from each affected service to the version.",
        detail:
          "A score nobody can audit is a score nobody acts on. This returns the actual ordered links.",
        params: [
          { name: "versionKey", type: "path · string", required: true, about: "URL-encoded version key." },
          DEPTH,
        ],
        response: `{
  "version": "npm:axios@1.7.2",
  "maxDepth": 5,
  "affectedServices": 1,
  "attackPaths": [
    {
      "serviceId": 2076504302,
      "serviceName": "payment-api",
      "environment": "production",
      "hops": 0,
      "path": ["npm:axios@1.7.2"]
    }
  ]
}`,
        curl: `curl "$CHAINTRACE_API/versions/npm:axios@1.7.2/attack-path?depth=5"`,
        console: { href: "/console/paths", label: "Attack paths" },
      },
      {
        id: "risk",
        method: "GET",
        path: "/versions/:versionKey/risk",
        summary: "A 0–100 score per affected service, rolled up to the version.",
        detail:
          "Every score arrives with the reasons that produced it, so the ranking is arguable — which is the point.",
        params: [
          { name: "versionKey", type: "path · string", required: true, about: "URL-encoded version key." },
          DEPTH,
        ],
        response: `{
  "version": "npm:axios@1.7.2",
  "score": 100,
  "severity": "CRITICAL",
  "affectedServices": 4,
  "productionServices": 3,
  "services": [
    {
      "serviceId": 2076504302,
      "name": "payment-api",
      "environment": "production",
      "hops": 0,
      "score": 90,
      "severity": "CRITICAL",
      "reasons": ["Affected production service", "Direct dependency"]
    }
  ],
  "maxDepth": 5
}`,
        curl: `curl "$CHAINTRACE_API/versions/npm:axios@1.7.2/risk?depth=5"`,
        console: { href: "/console/risk", label: "Risk" },
      },
      {
        id: "co-maintainers",
        method: "GET",
        path: "/versions/:versionKey/co-maintainers",
        summary: "Packages sharing at least one maintainer with this one.",
        detail:
          "A stolen publish token is not scoped to the package you noticed. Sorted by shared count, then alphabetically.",
        params: [
          { name: "versionKey", type: "path · string", required: true, about: "URL-encoded version key." },
        ],
        response: `{
  "version": "npm:axios@1.7.2",
  "coMaintainerCount": 2,
  "packages": [
    { "packageName": "follow-redirects", "sharedMaintainers": ["nick"], "sharedCount": 1 }
  ]
}`,
        errors: [
          ["404", "Version not found"],
          ["500", "Failed to query co-maintainers"],
        ],
        curl: `curl "$CHAINTRACE_API/versions/npm:axios@1.7.2/co-maintainers"`,
        console: { href: "/console/maintainers", label: "Co-maintainers" },
      },
    ],
  },
  {
    id: "detection",
    title: "Detection",
    blurb:
      "Two questions that are not traversals: which lockfiles took the bad version, and which names are close enough to be mistaken for it.",
    endpoints: [
      {
        id: "lockfiles-resolve",
        method: "POST",
        path: "/lockfiles/resolve",
        summary: "Which lockfile entries resolved to the compromised version.",
        detail:
          "Ranges do not answer this — only a resolved entry does. Each entry is checked against the graph, and the ones a service reaches through are reported with hop counts.",
        body: [
          {
            name: "compromisedVersion",
            type: "string",
            required: true,
            about: "Full version key, e.g. npm:axios@1.7.2.",
          },
          {
            name: "entries",
            type: "{ name, version }[]",
            required: true,
            about: "Resolved lockfile entries to check.",
          },
        ],
        response: `{
  "compromisedVersion": "npm:axios@1.7.2",
  "compromisedPackage": "axios",
  "checkedEntries": 3,
  "resolvedToCompromised": 1,
  "matches": [
    {
      "name": "axios",
      "version": "1.7.2",
      "inGraph": true,
      "services": [
        { "serviceName": "payment-api", "environment": "production", "hops": 0 }
      ]
    }
  ]
}`,
        errors: [
          ["400", "compromisedVersion is required / entries array is required"],
          ["404", "Version not found"],
        ],
        curl: `curl -X POST "$CHAINTRACE_API/lockfiles/resolve" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "compromisedVersion": "npm:axios@1.7.2",
    "entries": [{ "name": "axios", "version": "1.7.2" }]
  }'`,
        console: { href: "/console/lockfile", label: "Lockfile resolve" },
      },
      {
        id: "typosquat",
        method: "GET",
        path: "/typosquat/:packageName",
        summary: "Package names within a few edits of a target.",
        detail:
          "Levenshtein distance over every Package name in the graph. Distance alone is noisy, so a shared prefix or suffix and a popularity band come back alongside it.",
        params: [
          { name: "packageName", type: "path · string", required: true, about: "Name to check." },
          {
            name: "threshold",
            type: "query · integer",
            default: "2",
            about: "Maximum edit distance, 1–5.",
          },
        ],
        response: `{
  "targetPackage": "axios",
  "threshold": 2,
  "candidates": [
    {
      "packageName": "axio",
      "editDistance": 1,
      "sharedPrefix": true,
      "sharedSuffix": false,
      "popularity": "unknown",
      "riskSignal": "Edit distance 1 — shared prefix"
    }
  ]
}`,
        curl: `curl "$CHAINTRACE_API/typosquat/axios?threshold=2"`,
        console: { href: "/console/typosquat", label: "Typosquat" },
      },
    ],
  },
  {
    id: "ingest",
    title: "Ingest",
    blurb:
      "The writes. Both are GETs on this API but they crawl a registry and mutate the graph, so treat them accordingly.",
    endpoints: [
      {
        id: "npm-ingest",
        method: "GET",
        path: "/packages/:packageName/:version/ingest",
        summary: "Crawl an npm package and write it into the graph.",
        writes: true,
        params: [
          { name: "packageName", type: "path · string", required: true, about: "npm package name." },
          { name: "version", type: "path · string", required: true, about: "Exact version." },
          { ...DEPTH, default: "2", about: "Transitive depth to crawl." },
        ],
        response: `{
  "success": true,
  "packageName": "axios",
  "version": "1.7.2",
  "versionKey": "npm:axios@1.7.2",
  "stats": { "packages": 5, "versions": 5, "dependencyEdges": 4, "maintainers": 1 }
}`,
        curl: `curl "$CHAINTRACE_API/packages/axios/1.7.2/ingest?depth=1"`,
      },
      {
        id: "pypi-ingest",
        method: "GET",
        path: "/pypi/:packageName/:version/ingest",
        summary: "Crawl a PyPI package and write it into the graph.",
        detail:
          "Fetches from pypi.org, normalises PEP 508 dependency strings into the same shape as npm's, resolves specifiers to concrete versions, and writes everything under the pypi: prefix.",
        writes: true,
        params: [
          { name: "packageName", type: "path · string", required: true, about: "PyPI package name." },
          { name: "version", type: "path · string", required: true, about: "Exact version." },
          { ...DEPTH, default: "2", about: "Transitive depth to crawl." },
        ],
        response: `{
  "success": true,
  "packageName": "requests",
  "version": "2.32.3",
  "versionKey": "pypi:requests@2.32.3",
  "stats": { "packages": 5, "versions": 5, "dependencyEdges": 4 }
}`,
        errors: [
          ["400", "Package name / version required, or depth not a non-negative integer"],
          ["500", "PyPI package ingestion failed"],
        ],
        curl: `curl "$CHAINTRACE_API/pypi/requests/2.32.3/ingest?depth=1"`,
      },
    ],
  },
];

/* ── risk scoring, as implemented ─────────────────────────────── */

export const RISK_SERVICE_RULES: [string, string][] = [
  ["+60", "environment is production"],
  ["+30", "environment is staging"],
  ["+10", "any other environment"],
  ["+30", "direct dependency (0 hops)"],
  ["+20", "one hop away"],
  ["+10", "within three hops"],
];

export const RISK_ROLLUP_RULES: [string, string][] = [
  ["max", "the worst affected service sets the floor"],
  ["+10", "two or more production services affected"],
  ["+10", "five or more production services affected"],
];

export const RISK_BANDS: [string, string][] = [
  ["≥ 80", "CRITICAL"],
  ["≥ 60", "HIGH"],
  ["≥ 30", "MEDIUM"],
  ["< 30", "LOW"],
];

/* ── CLI ──────────────────────────────────────────────────────── */

export interface CliCommand {
  id: string;
  name: string;
  summary: string;
  detail?: string;
  usage: string[];
  flags?: [string, string, string, string][];
  steps?: string[];
}

export const CLI_COMMANDS: CliCommand[] = [
  {
    id: "cli-scan",
    name: "chaintrace scan",
    summary: "Scan a project's lockfile and analyse every dependency.",
    detail:
      "Detects the lockfile, resolves every range to the version the installer would actually pick, analyses each dependency, and sets an exit code for CI.",
    usage: [
      "chaintrace scan",
      "chaintrace scan --path ./my-project",
      "chaintrace scan --path ./backend --depth 3",
      "chaintrace scan -p ./frontend -d 5",
    ],
    flags: [
      ["--path <path>", "-p", '"."', "Project directory to scan"],
      ["--depth <number>", "-d", '"5"', "Traversal depth for the dependency graph (0–5)"],
    ],
    steps: [
      "Detect the lockfile type",
      "Parse it and extract every dependency",
      "Per dependency: analysis, auto-ingesting anything the graph has not seen",
      "Sort by severity, CRITICAL first",
      "Print the summary and set the exit code",
    ],
  },
  {
    id: "cli-check",
    name: "chaintrace check <package@version>",
    summary: "Analyse one package version.",
    usage: [
      "chaintrace check axios@1.7.2",
      "chaintrace check react@19.2.8 --depth 5",
      "chaintrace check lodash@4.17.21 -d 3",
    ],
    flags: [["--depth <number>", "-d", '"5"', "Traversal depth (0–5)"]],
  },
  {
    id: "cli-github",
    name: "chaintrace github login",
    summary: "Authenticate against GitHub with the OAuth device flow.",
    detail:
      "Requests a device code, prints the verification URL and user code, then polls until you approve it. Needs GITHUB_CLIENT_ID set.",
    usage: ["chaintrace github login"],
  },
];

export const CLI_ENV: [string, string, string][] = [
  ["CHAINTRACE_API_URL", "http://localhost:3001", "Backend API base URL"],
  ["GITHUB_CLIENT_ID", "—", "GitHub OAuth app client ID, required for github login"],
  ["CHAINTRACE_DEBUG", "disabled", "Verbose logging"],
];

export const LOCKFILES: [string, string, string, string][] = [
  ["npm", "package-lock.json", "parsed", "v1, v2 and v3 formats"],
  ["npm", "npm-shrinkwrap.json", "parsed", "Same format as package-lock"],
  ["Bun", "bun.lock", "parsed", "JSON"],
  ["Bun", "bun.lockb", "parsed", "Binary, detected"],
  ["pip", "requirements.txt", "parsed", "PEP 508; exact == pins only"],
  ["Poetry", "poetry.lock", "parsed", "TOML"],
  ["Pipenv", "Pipfile.lock", "parsed", "JSON"],
  ["pnpm", "pnpm-lock.yaml", "detected", "Parsing not implemented yet"],
  ["Yarn", "yarn.lock", "detected", "Parsing not implemented yet"],
];

export const EXIT_CODES: [string, string, string][] = [
  ["0", "Success", "No CRITICAL or HIGH findings"],
  ["1", "Warning", "HIGH findings present"],
  ["2", "Failure", "CRITICAL findings present"],
];

export const CI_EXAMPLE = `- name: ChainTrace security scan
  run: chaintrace scan --path . --depth 5
  env:
    CHAINTRACE_API_URL: \${{ secrets.CHAINTRACE_API_URL }}`;

/* ── console views ────────────────────────────────────────────── */

export const CONSOLE_VIEWS: [string, string, string][] = [
  ["/console", "GET /health · /services", "API map and graph summary"],
  ["/console/graph", "/packages/:n/graph", "3D graph, one sphere shell per hop"],
  ["/console/analysis", "/:n/:v/analysis", "Risk, blast radius and paths together"],
  ["/console/blast", "/blast-radius", "Services by hop distance, coloured by severity"],
  ["/console/paths", "/attack-path", "Each service→version chain, in order"],
  ["/console/risk", "/risk", "Score per service with reasons and the rules"],
  ["/console/maintainers", "/co-maintainers", "Packages sharing a publishing account"],
  ["/console/lockfile", "POST /lockfiles/resolve", "Which pasted entries took the bad version"],
  ["/console/typosquat", "/typosquat/:n", "Names within N edits, with signals"],
  ["/console/services", "GET /services", "The service registry"],
];

export const HTTP_ERRORS: [string, string][] = [
  ["400", "Bad request — missing or invalid parameters"],
  ["404", "Package or version not found in the graph"],
  ["405", "Method not allowed"],
  ["500", "Internal server error"],
];
