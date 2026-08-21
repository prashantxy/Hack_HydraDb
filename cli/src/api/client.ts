export interface PackageRiskResponse {
  version: string;

  score: number;

  severity:
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  affectedServices: number;

  productionServices: number;

  services: Array<{
    serviceId: number;
    name: string;
    environment: string | null;
    hops: number;
    score: number;
    severity: string;
    reasons: string[];
  }>;

  maxDepth: number;
}

export interface PackageAnalysis {
  packageName: string;

  version: string;

  versionKey: string;

  risk: PackageRiskResponse;

  blastRadius: {
    affectedServices: number;

    productionServices: number;

    services: Array<{
      id: number;
      name: string;
      repo: string | null;
      team: string | null;
      environment: string | null;
      hops: number;
    }>;
  };

  attackPaths: {
    affectedServices: number;

    paths: Array<{
      serviceId: number;
      serviceName: string;
      environment: string | null;
      hops: number;
      path: string[];
    }>;
  };

  maxDepth: number;
}

export interface IngestResponse {
  success: boolean;

  packageName: string;

  version: string;

  versionKey: string;

  stats: {
    packages: number;
    versions: number;
    dependencyEdges: number;
    packageVersionEdges: number;
    maintainers: number;
    maintainsEdges: number;
    processedNodes: number;
    skippedNodes: number;
    failedNodes: number;
    maxDepth: number;
  };
}

const API_URL =
  process.env.CHAINTRACE_API_URL ??
  "http://localhost:3001";

/* ==========================================================
 * URL BUILDER
 * ========================================================== */

function buildUrl(
  packageName: string,
  version: string,
  endpoint: string,
  depth: number,
): string {
  return (
    `${API_URL}/packages/` +
    `${encodeURIComponent(packageName)}/` +
    `${encodeURIComponent(version)}/` +
    `${endpoint}` +
    `?depth=${depth}`
  );
}

/* ==========================================================
 * GENERIC REQUEST
 * ========================================================== */

async function request<T>(
  url: string,
): Promise<T> {
  const response = await fetch(url);

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `ChainTrace API error (${response.status}): ${body}`,
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `Invalid JSON response from ChainTrace API: ${body}`,
    );
  }
}

/* ==========================================================
 * RISK
 * ========================================================== */

export async function getPackageRisk(
  packageName: string,
  version: string,
  depth = 5,
): Promise<PackageRiskResponse> {
  const url = buildUrl(
    packageName,
    version,
    "risk",
    depth,
  );

  return request<PackageRiskResponse>(url);
}

/* ==========================================================
 * FULL ANALYSIS
 * ========================================================== */

export async function checkPackage(
  packageName: string,
  version: string,
  depth = 5,
): Promise<PackageAnalysis> {
  const url = buildUrl(
    packageName,
    version,
    "analysis",
    depth,
  );

  return request<PackageAnalysis>(url);
}

/* ==========================================================
 * INGEST PACKAGE
 *
 * GET:
 * /packages/:packageName/:version/ingest
 *
 * Used when the package/version does not exist
 * in HydraDB yet.
 * ========================================================== */

export async function ingestPackage(
  packageName: string,
  version: string,
  depth = 3,
): Promise<IngestResponse> {
  const url = buildUrl(
    packageName,
    version,
    "ingest",
    depth,
  );

  return request<IngestResponse>(url);
}

/* ==========================================================
 * ENSURE PACKAGE EXISTS
 *
 * 1. Try analysis.
 * 2. If package/version is missing, ingest it.
 * 3. Retry analysis.
 * ========================================================== */

export async function ensurePackage(
  packageName: string,
  version: string,
  depth = 5,
): Promise<PackageAnalysis> {
  try {
    return await checkPackage(
      packageName,
      version,
      depth,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      !message.includes("Version not found") &&
      !message.includes("Package not found")
    ) {
      throw error;
    }

    await ingestPackage(
      packageName,
      version,
      depth,
    );

    return checkPackage(
      packageName,
      version,
      depth,
    );
  }
}

/* ==========================================================
 * MULTIPLE PACKAGES
 * ========================================================== */

export async function checkPackages(
  dependencies: Array<{
    name: string;
    version: string;
  }>,
  depth = 5,
): Promise<PackageAnalysis[]> {
  const results: PackageAnalysis[] = [];

  for (const dependency of dependencies) {
    try {
      const result = await ensurePackage(
        dependency.name,
        dependency.version,
        depth,
      );

      results.push(result);
    } catch (error) {
      console.error(
        `Failed to analyze ${dependency.name}@${dependency.version}`,
      );

      if (process.env.CHAINTRACE_DEBUG) {
        console.error(error);
      }
    }
  }

  return results;
}