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

export interface ScanResult {
  lockfile: {
    type: string;
    path: string;
  };

  dependencies: Dependency[];
}

/*
 * ==========================================================
 * SCAN PROJECT LOCKFILE
 * ==========================================================
 *
 * Responsibilities:
 *
 * 1. Detect the project's lockfile
 * 2. Parse the lockfile
 * 3. Return normalized dependencies
 *
 * This file does NOT:
 *
 * - call ChainTrace API
 * - ingest packages
 * - calculate risk
 * - analyze dependencies
 *
 * Those responsibilities belong to:
 *
 * cli/src/command/scan.ts
 * cli/src/api/client.ts
 */

export async function scanProject(
  cwd = process.cwd(),
): Promise<ScanResult> {
  const lockfile =
    detectLockfile(cwd);

  /*
   * --------------------------------------------------------
   * No lockfile
   * --------------------------------------------------------
   */

  if (!lockfile.path) {
    throw new Error(
      "No supported lockfile found. " +
      "Expected package-lock.json, " +
      "bun.lock, " +
      "pnpm-lock.yaml or " +
      "yarn.lock",
    );
  }

  /*
   * --------------------------------------------------------
   * Parse lockfile
   * --------------------------------------------------------
   */

  let dependencies: Dependency[] = [];

  switch (lockfile.type) {
    /*
     * ------------------------------------------------------
     * npm
     * ------------------------------------------------------
     */

    case "npm":
      dependencies =
        await parseNpmLockfile(
          lockfile.path,
        );
      break;

    /*
     * ------------------------------------------------------
     * Bun
     * ------------------------------------------------------
     */

    case "bun":
      dependencies =
        await parseBunLockfile(
          lockfile.path,
        );
      break;

    /*
     * ------------------------------------------------------
     * pnpm
     * ------------------------------------------------------
     */

    case "pnpm":
      throw new Error(
        "pnpm-lock.yaml detected, " +
        "but pnpm parsing is not implemented yet",
      );

    /*
     * ------------------------------------------------------
     * Yarn
     * ------------------------------------------------------
     */

    case "yarn":
      throw new Error(
        "yarn.lock detected, " +
        "but Yarn parsing is not implemented yet",
      );

    /*
     * ------------------------------------------------------
     * Unknown
     * ------------------------------------------------------
     */

    default:
      throw new Error(
        `Lockfile type '${lockfile.type}' ` +
        `is not supported`,
      );
  }

  /*
   * --------------------------------------------------------
   * Return scan result
   * --------------------------------------------------------
   */

  return {
    lockfile: {
      type: lockfile.type,
      path: lockfile.path,
    },

    dependencies,
  };
}