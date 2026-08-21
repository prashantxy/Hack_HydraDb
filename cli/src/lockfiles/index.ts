import {
  detectLockfile,
} from "./detect";

import {
  parseNpmLockfile,
  type Dependency,
} from "./npm";

import {
  parseBunLockfile,
} from "./bun";

import {
  parsePnpmLockfile,
} from "./pnpm-lock";

import {
  parseYarnLockfile,
} from "./yarn-lock";

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

  if (
    !lockfile.path
  ) {
    throw new Error(
      "No supported lockfile found. Expected package-lock.json, pnpm-lock.yaml or yarn.lock",
    );
  }

  let dependencies:
    Dependency[] = [];

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
      dependencies =
        await parsePnpmLockfile(
          lockfile.path,
        );
      break;

    case "yarn":
      dependencies =
        await parseYarnLockfile(
          lockfile.path,
        );
      break;

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