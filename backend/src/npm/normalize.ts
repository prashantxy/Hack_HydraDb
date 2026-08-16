import type {
  NpmVersionMetadata,
} from "./registry";

export interface NormalizedDependency {
  name: string;
  range: string;
  type: "runtime" | "optional" | "peer";
}

export interface NormalizedPackageVersion {
  packageName: string;
  version: string;
  key: string;
  dependencies: NormalizedDependency[];
}

export function normalizePackageVersion(
  metadata: NpmVersionMetadata,
): NormalizedPackageVersion {
  const dependencies: NormalizedDependency[] = [];

  for (const [name, range] of Object.entries(
    metadata.dependencies ?? {},
  )) {
    dependencies.push({
      name,
      range,
      type: "runtime",
    });
  }

  for (const [name, range] of Object.entries(
    metadata.optionalDependencies ?? {},
  )) {
    dependencies.push({
      name,
      range,
      type: "optional",
    });
  }

  for (const [name, range] of Object.entries(
    metadata.peerDependencies ?? {},
  )) {
    dependencies.push({
      name,
      range,
      type: "peer",
    });
  }

  return {
    packageName: metadata.name,
    version: metadata.version,
    key: `npm:${metadata.name}@${metadata.version}`,
    dependencies,
  };
}