import { readFile } from "node:fs/promises";

export interface Dependency {
  name: string;
  version: string;
  source: "lockfile";
  dev: boolean;
  resolved?: string;
  integrity?: string;
}

interface PackageLock {
  lockfileVersion?: number;

  packages?: Record<
    string,
    {
      version?: string;
      resolved?: string;
      integrity?: string;
      dev?: boolean;
    }
  >;

  dependencies?: Record<
    string,
    {
      version?: string;
      resolved?: string;
      integrity?: string;
      dev?: boolean;
    }
  >;
}

export async function parseNpmLockfile(
  path: string,
): Promise<Dependency[]> {
  const raw =
    await readFile(path, "utf8");

  const lockfile =
    JSON.parse(raw) as PackageLock;

  const result: Dependency[] = [];

  /*
   * npm lockfile v2/v3
   *
   * packages:
   *
   * node_modules/axios
   * node_modules/react
   * ...
   */

  if (lockfile.packages) {
    for (
      const [
        packagePath,
        metadata,
      ] of Object.entries(
        lockfile.packages,
      )
    ) {
      if (
        !packagePath.startsWith(
          "node_modules/",
        )
      ) {
        continue;
      }

      if (!metadata.version) {
        continue;
      }

      const name =
        packagePath
          .replace(
            /^node_modules\//,
            "",
          );

      result.push({
        name,
        version: metadata.version,
        source: "lockfile",
        dev: Boolean(metadata.dev),
        resolved:
          metadata.resolved,
        integrity:
          metadata.integrity,
      });
    }

    return result;
  }

  /*
   * npm lockfile v1 fallback.
   */

  if (lockfile.dependencies) {
    for (
      const [
        name,
        metadata,
      ] of Object.entries(
        lockfile.dependencies,
      )
    ) {
      if (!metadata.version) {
        continue;
      }

      result.push({
        name,
        version: metadata.version,
        source: "lockfile",
        dev: Boolean(metadata.dev),
        resolved:
          metadata.resolved,
        integrity:
          metadata.integrity,
      });
    }
  }

  return result;
}