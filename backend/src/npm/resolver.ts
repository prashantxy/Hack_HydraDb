import semver from "semver";

interface NpmPackageMetadata {
  versions: Record<string, unknown>;
}

export async function resolveVersion(
  packageName: string,
  range: string,
): Promise<string> {
  const url =
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${packageName}: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  const data =
    (await response.json()) as NpmPackageMetadata;

  const versions = Object.keys(data.versions)
    .filter((version) => semver.valid(version))
    .filter((version) => !semver.prerelease(version));

  const resolved = semver.maxSatisfying(
    versions,
    range,
  );

  if (!resolved) {
    throw new Error(
      `Could not resolve ${packageName}@${range}`,
    );
  }

  return resolved;
}