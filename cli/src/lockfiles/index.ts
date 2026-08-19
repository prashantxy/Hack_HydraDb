import {
  detectLockfile,
} from "./detect";

import {
  parseNpmLockfile,
  type Dependency,
} from "./npm";

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