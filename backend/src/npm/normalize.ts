import type {
  NpmVersionMetadata,
} from "./registry";

export interface NormalizedDependency {
  name: string;
  range: string;
  type:
    | "runtime"
    | "optional"
    | "peer";
}

export interface NormalizedPackageVersion {
  key: string;
  packageName: string;
  version: string;
  dependencies: NormalizedDependency[];
  maintainers: string[];
  publishedAt: string | null;
}

export function normalizePackageVersion(
  metadata: NpmVersionMetadata,
  publishedAt?: string | null,
): NormalizedPackageVersion {
  const dependencies: NormalizedDependency[] = [];

  /*
   * Runtime dependencies
   */
  for (
    const [name, range] of Object.entries(
      metadata.dependencies ?? {},
    )
  ) {
    dependencies.push({
      name,
      range,
      type: "runtime",
    });
  }

  /*
   * Optional dependencies
   */
  for (
    const [name, range] of Object.entries(
      metadata.optionalDependencies ?? {},
    )
  ) {
    dependencies.push({
      name,
      range,
      type: "optional",
    });
  }

  /*
   * Peer dependencies
   */
  for (
    const [name, range] of Object.entries(
      metadata.peerDependencies ?? {},
    )
  ) {
    dependencies.push({
      name,
      range,
      type: "peer",
    });
  }

  /*
   * Deterministic package identity
   */
  const packageName = metadata.name;
  const version = metadata.version;

  const key =
    `npm:${packageName}@${version}`;

  /*
   * npm maintainers
   *
   * Example:
   * [
   *   { name: "username", email: "..." }
   * ]
   *
   * We only persist the npm username.
   */
  const maintainers =
    metadata.maintainers?.map(
      (maintainer: { name: any; }) => maintainer.name,
    ) ?? [];

  return {
    packageName,
    version,
    key,
    dependencies,
    maintainers,
    publishedAt: publishedAt ?? null,
  };
}