import semver from "semver";

import type { NpmRegistryResponse } from "./registry";

interface NpmPackageMetadata {
  versions: Record<string, unknown>;
}

export interface ResolvedVersionMeta {
  version: string;
  publishedAt: string | null;
}

/**
 * Resolve a semver range to a concrete version and
 * report when that version was published.
 */
export async function resolveVersionMeta(
  packageName: string,
  range: string,
): Promise<ResolvedVersionMeta> {
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
    (await response.json()) as NpmPackageMetadata & NpmRegistryResponse;

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

  const publishedAt =
    data.time?.[resolved] ?? null;

  return {
    version: resolved,
    publishedAt:
      publishedAt && !Number.isNaN(Date.parse(publishedAt))
        ? new Date(publishedAt).toISOString()
        : null,
  };
}

export async function resolveVersion(
  packageName: string,
  range: string,
): Promise<string> {
  const meta = await resolveVersionMeta(
    packageName,
    range,
  );

  return meta.version;
}