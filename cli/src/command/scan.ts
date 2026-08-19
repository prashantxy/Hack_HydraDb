import {
  detectLockfile,
} from "../lockfiles/detect";

import {
  parseNpmLockfile,
  type Dependency,
} from "../lockfiles/npm";

import {
  parseBunLockfile,
} from "../lockfiles/bun";

export interface ScanResult {
  lockfile: {
    type: string;
    path: string;
  };

  dependencies: Dependency[];
}

export async function scanProject(
  cwd = process.cwd(),
): Promise<ScanResult> {
  const lockfile =
    detectLockfile(cwd);

  if (!lockfile.path) {
    throw new Error(
      "No supported lockfile found. Expected package-lock.json, bun.lock, pnpm-lock.yaml or yarn.lock",
    );
  }

  let dependencies: Dependency[] = [];

  switch (lockfile.type) {
    case "npm":
      dependencies =
        await parseNpmLockfile(
          lockfile.path,
        );
      break;

    case "bun":
      dependencies =
        await parseBunLockfile(
          lockfile.path,
        );
      break;

    case "pnpm":
      throw new Error(
        "pnpm lockfile detected, but pnpm parsing is not implemented yet",
      );

    case "yarn":
      throw new Error(
        "yarn lockfile detected, but yarn parsing is not implemented yet",
      );

    default:
      throw new Error(
        `Lockfile type '${lockfile.type}' is not supported yet`,
      );
  }

  return {
    lockfile: {
      type: lockfile.type,
      path: lockfile.path,
    },

    dependencies,
  };
}