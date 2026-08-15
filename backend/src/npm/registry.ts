export interface NpmVersionMetadata {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  repository?: unknown;
}

interface NpmRegistryResponse {
  name: string;
  versions: Record<string, NpmVersionMetadata>;
}

export async function fetchNpmPackage(
  packageName: string,
): Promise<NpmRegistryResponse> {
  const encoded = encodeURIComponent(packageName);

  const response = await fetch(
    `https://registry.npmjs.org/${encoded}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `npm registry request failed (${response.status})`,
    );
  }

  return response.json() as Promise<NpmRegistryResponse>;
}