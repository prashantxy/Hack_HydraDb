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

const API_URL =
  process.env.CHAINTRACE_API_URL ??
  "http://localhost:3000";

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

async function request<T>(
  url: string,
): Promise<T> {
  const response =
    await fetch(url);

  const body =
    await response.text();

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

/*
 * ==========================================================
 * RISK
 * ==========================================================
 */

export async function getPackageRisk(
  packageName: string,
  version: string,
  depth = 5,
): Promise<PackageRiskResponse> {
  const url =
    buildUrl(
      packageName,
      version,
      "risk",
      depth,
    );

  return request<PackageRiskResponse>(
    url,
  );
}

/*
 * ==========================================================
 * FULL ANALYSIS
 * ==========================================================
 */

export async function checkPackage(
  packageName: string,
  version: string,
  depth = 5,
): Promise<PackageAnalysis> {
  const url =
    buildUrl(
      packageName,
      version,
      "analysis",
      depth,
    );

  return request<PackageAnalysis>(
    url,
  );
}

/*
 * ==========================================================
 * MULTIPLE PACKAGES
 * ==========================================================
 */

export async function checkPackages(
  dependencies: Array<{
    name: string;
    version: string;
  }>,
  depth = 5,
): Promise<PackageAnalysis[]> {
  const results: PackageAnalysis[] = [];

  for (
    const dependency
    of dependencies
  ) {
    try {
      const result =
        await checkPackage(
          dependency.name,
          dependency.version,
          depth,
        );

      results.push(result);
    } catch (error) {
      console.error(
        `Failed to analyze ${dependency.name}@${dependency.version}`,
      );

      if (
        process.env.CHAINTRACE_DEBUG
      ) {
        console.error(error);
      }
    }
  }

  return results;
}