/**
 * PyPI Registry Client
 *
 * Fetches package metadata from the public PyPI JSON API:
 *   https://pypi.org/pypi/<package>/json
 *   https://pypi.org/pypi/<package>/<version>/json
 */

export interface PyPIVersionInfo {
  name: string;
  version: string;
  requires_dist: string[] | null;
  requires_python: string | null;
  maintainer: string | null;
  maintainer_email: string | null;
  author: string | null;
  author_email: string | null;
  home_page: string | null;
  project_urls: Record<string, string> | null;
}

export interface PyPIReleaseFile {
  filename?: string;
  upload_time?: string;
  upload_time_iso_8601?: string;
}

export interface PyPIPackageResponse {
  info: PyPIVersionInfo;
  releases: Record<string, PyPIReleaseFile[]>;
  urls: unknown[];
}

export interface PyPIVersionResponse {
  info: PyPIVersionInfo;
  urls: PyPIReleaseFile[];
}

/**
 * Extract a normalized ISO publish timestamp from
 * the distribution files of a release (earliest upload).
 */
export function releasePublishedAt(
  files: PyPIReleaseFile[] | undefined,
): string | null {
  if (!files || files.length === 0) {
    return null;
  }

  const times = files
    .map(
      (file) =>
        file.upload_time_iso_8601 ?? file.upload_time ?? null,
    )
    .filter((t): t is string => !!t && !Number.isNaN(Date.parse(t)))
    .map((t) => new Date(t).toISOString())
    .sort();

  return times[0] ?? null;
}

/**
 * Fetch full package metadata from PyPI.
 * Returns all versions and their metadata.
 */
export async function fetchPyPIPackage(
  packageName: string,
): Promise<PyPIPackageResponse> {
  const encoded = encodeURIComponent(packageName);
  const url = `https://pypi.org/pypi/${encoded}/json`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `PyPI registry request failed (${response.status}) ${response.statusText}`,
    );
  }

  return (await response.json()) as PyPIPackageResponse;
}

/**
 * Fetch metadata for a single version from PyPI.
 * Also extracts the publish timestamp from the
 * distribution files when available.
 */
export async function fetchPyPIVersion(
  packageName: string,
  version: string,
): Promise<{ info: PyPIVersionInfo; publishedAt: string | null }> {
  const encoded = encodeURIComponent(packageName);
  const url = `https://pypi.org/pypi/${encoded}/${encodeURIComponent(version)}/json`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `PyPI version request failed (${response.status}) ${response.statusText}`,
    );
  }

  const data = (await response.json()) as PyPIVersionResponse;

  return {
    info: data.info,
    publishedAt: releasePublishedAt(data.urls),
  };
}
