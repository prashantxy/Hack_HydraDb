export interface NpmVersionInfo {
  version: string;
}

interface NpmPackageMetadata {
  versions: Record<string, NpmVersionInfo>;
}

export async function resolveVersion(
  packageName: string,
  range: string,
): Promise<string> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${packageName}: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as NpmPackageMetadata;

  const versions = Object.keys(data.versions);

  // Temporary resolver for M1.
  // First handle exact versions.
  if (versions.includes(range)) {
    return range;
  }

  // For now, we'll implement common npm ranges.
  // Don't try to build a full semver implementation ourselves.
  throw new Error(
    `Unable to resolve ${packageName}@${range}. Semver resolver not implemented yet.`,
  );
}