/*
 * Typed client for the ChainTrace backend.
 *
 * Route table, from backend/API_DOCUMENTATION.md and router.ts:
 *
 *   GET  /health
 *   GET  /services
 *   POST /services
 *   GET  /packages/:name
 *   GET  /packages/:name/graph?depth=1..5
 *   GET  /packages/:name/:version/ingest?depth=
 *   GET  /packages/:name/:version/analysis?depth=
 *   GET  /packages/:name/:version/risk?depth=
 *   GET  /versions/:key/dependencies
 *   GET  /versions/:key/blast-radius?depth=
 *   GET  /versions/:key/risk?depth=
 *   GET  /versions/:key/attack-path?depth=
 *   GET  /versions/:key/co-maintainers
 *   POST /lockfiles/resolve
 *   GET  /typosquat/:name?threshold=1..5
 *   GET  /pypi/:name/:version/ingest?depth=
 *
 * The backend serves Access-Control-Allow-Origin: *, so the browser
 * can call it directly. It listens on PORT (default 3000), which
 * collides with `next dev` — run it elsewhere and point
 * NEXT_PUBLIC_CHAINTRACE_API at it.
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_CHAINTRACE_API ?? "http://localhost:4000"
).replace(/\/$/, "");

/* ── shared shapes ───────────────────────────────────────────── */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/* the graph holds both ecosystems, distinguished by the key prefix */
export type Ecosystem = "npm" | "pypi";

export const ECOSYSTEMS: Ecosystem[] = ["npm", "pypi"];

export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export interface GraphNode {
  id: string;
  packageName: string;
  version: string;
  depth: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  packageName: string | null;
  versionRange: string | null;
  dependencyType: string | null;
  depth: number;
}

export interface PackageGraph {
  package: string;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PackageInfo {
  package: string;
  versions: { key: string; version: string }[];
}

export interface VersionDependency {
  key: string;
  packageName: string;
  version: string;
  versionRange?: string | null;
  dependencyType?: string | null;
}

export interface BlastService {
  id: number;
  name: string;
  repo: string;
  team: string | null;
  environment: string | null;
  hops: number;
}

export interface BlastRadius {
  version: string;
  maxDepth: number;
  affectedServices: number;
  services: BlastService[];
}

export interface AttackPath {
  serviceId: number;
  serviceName: string;
  environment: string | null;
  hops: number;
  path: string[];
}

export interface AttackPaths {
  version: string;
  maxDepth: number;
  affectedServices: number;
  attackPaths: AttackPath[];
}

export interface ServiceRisk {
  serviceId: number;
  name: string;
  environment: string | null;
  hops: number;
  score: number;
  severity: Severity;
  reasons: string[];
}

export interface PackageRisk {
  version: string;
  score: number;
  severity: Severity;
  affectedServices: number;
  productionServices: number;
  services: ServiceRisk[];
  maxDepth: number;
}

export interface SecurityAnalysis {
  packageName: string;
  version: string;
  versionKey: string;
  risk: PackageRisk;
  blastRadius: {
    affectedServices: number;
    productionServices: number;
    services: BlastService[];
  };
  attackPaths: {
    affectedServices: number;
    paths: AttackPath[];
  };
  maxDepth: number;
}

export interface ServiceRow {
  id: number;
  name: string;
  repo: string;
  team: string | null;
  environment: string | null;
}

export interface ServicesResponse {
  success: boolean;
  count: number;
  services: ServiceRow[];
}

export interface CoMaintainerPackage {
  packageName: string;
  sharedMaintainers: string[];
  sharedCount: number;
}

export interface CoMaintainers {
  version: string;
  coMaintainerCount: number;
  packages: CoMaintainerPackage[];
}

export interface LockfileEntry {
  name: string;
  version: string;
}

export interface LockfileMatchService {
  serviceName: string;
  environment: string | null;
  hops: number;
}

export interface LockfileMatch extends LockfileEntry {
  inGraph: boolean;
  services: LockfileMatchService[];
}

export interface LockfileResolve {
  compromisedVersion: string;
  compromisedPackage: string;
  checkedEntries: number;
  resolvedToCompromised: number;
  matches: LockfileMatch[];
}

export type Popularity = "high" | "medium" | "low" | "unknown";

export interface TyposquatCandidate {
  packageName: string;
  editDistance: number;
  sharedPrefix: boolean;
  sharedSuffix: boolean;
  popularity: Popularity;
  riskSignal: string;
}

export interface Typosquat {
  targetPackage: string;
  threshold: number;
  candidates: TyposquatCandidate[];
}

export interface IngestResponse {
  success: boolean;
  packageName: string;
  version: string;
  versionKey: string;
  stats: Record<string, number>;
}

/* ── transport ───────────────────────────────────────────────── */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    // network-level: unreachable, DNS, CORS, mixed content
    throw new ApiError(`Cannot reach the API at ${API_BASE}`, 0);
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

async function post<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(`Cannot reach the API at ${API_BASE}`, 0);
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      (payload as { error?: string })?.error ?? `Request failed (${res.status})`,
      res.status,
    );
  }

  return payload as T;
}

/* version keys look like npm:axios@1.7.2 or pypi:requests@2.32.3, and
 * must be encoded whole */
export const versionKey = (
  name: string,
  version: string,
  ecosystem: Ecosystem = "npm",
) => `${ecosystem}:${name}@${version}`;

/* strip either ecosystem prefix for display. The graph endpoint only
 * strips "npm:" server-side, so pypi nodes can arrive still prefixed. */
export function stripEcosystem(value: string): string {
  return value.replace(/^(npm|pypi):/, "");
}

export function ecosystemOf(key: string): Ecosystem | null {
  if (key.startsWith("pypi:")) return "pypi";
  if (key.startsWith("npm:")) return "npm";
  return null;
}

const enc = encodeURIComponent;
const depthParam = (depth?: number) =>
  depth === undefined ? "" : `?depth=${depth}`;

/* ── endpoints ───────────────────────────────────────────────── */

export const api = {
  health: (s?: AbortSignal) => get<{ status?: string }>("/health", s),

  services: (s?: AbortSignal) => get<ServicesResponse>("/services", s),

  packageInfo: (name: string, s?: AbortSignal) =>
    get<PackageInfo>(`/packages/${enc(name)}`, s),

  packageGraph: (name: string, depth: number, s?: AbortSignal) =>
    get<PackageGraph>(`/packages/${enc(name)}/graph?depth=${depth}`, s),

  versionDependencies: (key: string, s?: AbortSignal) =>
    get<{ version: string; dependencies: VersionDependency[] }>(
      `/versions/${enc(key)}/dependencies`,
      s,
    ),

  blastRadius: (key: string, depth?: number, s?: AbortSignal) =>
    get<BlastRadius>(
      `/versions/${enc(key)}/blast-radius${depthParam(depth)}`,
      s,
    ),

  attackPaths: (key: string, depth?: number, s?: AbortSignal) =>
    get<AttackPaths>(
      `/versions/${enc(key)}/attack-path${depthParam(depth)}`,
      s,
    ),

  risk: (key: string, depth?: number, s?: AbortSignal) =>
    get<PackageRisk>(`/versions/${enc(key)}/risk${depthParam(depth)}`, s),

  analysis: (name: string, version: string, depth?: number, s?: AbortSignal) =>
    get<SecurityAnalysis>(
      `/packages/${enc(name)}/${enc(version)}/analysis${depthParam(depth)}`,
      s,
    ),

  packageVersionRisk: (
    name: string,
    version: string,
    depth?: number,
    s?: AbortSignal,
  ) =>
    get<PackageRisk>(
      `/packages/${enc(name)}/${enc(version)}/risk${depthParam(depth)}`,
      s,
    ),

  coMaintainers: (key: string, s?: AbortSignal) =>
    get<CoMaintainers>(`/versions/${enc(key)}/co-maintainers`, s),

  typosquat: (name: string, threshold?: number, s?: AbortSignal) =>
    get<Typosquat>(
      `/typosquat/${enc(name)}${threshold === undefined ? "" : `?threshold=${threshold}`}`,
      s,
    ),

  lockfileResolve: (
    compromisedVersion: string,
    entries: LockfileEntry[],
    s?: AbortSignal,
  ) =>
    post<LockfileResolve>(
      "/lockfiles/resolve",
      { compromisedVersion, entries },
      s,
    ),

  /* both ingest routes are GETs on this API, but they write — never
   * call them on mount, only from an explicit action */
  ingest: (name: string, version: string, depth?: number, s?: AbortSignal) =>
    get<IngestResponse>(
      `/packages/${enc(name)}/${enc(version)}/ingest${depthParam(depth)}`,
      s,
    ),

  pypiIngest: (name: string, version: string, depth?: number, s?: AbortSignal) =>
    get<IngestResponse>(
      `/pypi/${enc(name)}/${enc(version)}/ingest${depthParam(depth)}`,
      s,
    ),
};
