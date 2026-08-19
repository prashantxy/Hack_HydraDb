export interface PackageAnalysis {
  packageName: string;
  version: string;
  versionKey: string;

  risk: {
    score: number;
    severity: string;
    affectedServices: number;
    productionServices: number;
  };

  blastRadius: {
    affectedServices: number;
    productionServices: number;
    services: unknown[];
  };

  attackPaths: {
    affectedServices: number;
    paths: unknown[];
  };

  maxDepth: number;
}

const API_URL =
  process.env.CHAINTRACE_API_URL ??
  "http://localhost:3000";

export async function checkPackage(
  packageName: string,
  version: string,
  depth = 5,
): Promise<PackageAnalysis> {
  const url =
    `${API_URL}/packages/` +
    `${encodeURIComponent(packageName)}/` +
    `${encodeURIComponent(version)}` +
    `/analysis?depth=${depth}`;

  const response =
    await fetch(url);

  const body =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `ChainTrace API error (${response.status}): ${body}`,
    );
  }

  return JSON.parse(body);
}

export async function checkPackages(
  dependencies: {
    name: string;
    version: string;
  }[],
  depth = 5,
): Promise<PackageAnalysis[]> {
  const results: PackageAnalysis[] = [];

  for (const dependency of dependencies) {
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
    }
  }

  return results;
}