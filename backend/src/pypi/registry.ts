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

export interface PyPIPackageResponse {
  info: PyPIVersionInfo;
  releases: Record<string, PyPIVersionInfo[]>;
  urls: unknown[];
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
 */
export async function fetchPyPIVersion(
  packageName: string,
  version: string,
): Promise<PyPIVersionInfo> {
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

  const data = (await response.json()) as {
    info: PyPIVersionInfo;
  };

  return data.info;
}
