export interface NpmMaintainer {
  name: string;
  email?: string;
}

export interface NpmVersionMetadata {
  maintainers: any;
  name: string;
  version: string;

  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;

  repository?: unknown;
}

export interface NpmRegistryResponse {
  maintainers: never[];
  name: string;

  versions: Record<string, NpmVersionMetadata>;

  "dist-tags"?: Record<string, string>;
}

export async function fetchNpmPackage(
  packageName: string,
): Promise<NpmRegistryResponse> {
  const encodedPackageName =
    encodeURIComponent(packageName);

  const url =
    `https://registry.npmjs.org/${encodedPackageName}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `npm registry request failed ` +
      `(${response.status}) ${response.statusText}`,
    );
  }

  return response.json() as Promise<NpmRegistryResponse>;
}