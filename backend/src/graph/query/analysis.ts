import {
  getBlastRadius,
  type BlastRadiusService,
} from "./blast-radius";

import {
  getPackageRisk,
  type PackageRisk,
} from "./risk";

import {
  getAttackPaths,
  type AttackPath,
} from "./attack-path";

export interface SecurityAnalysis {
  packageName: string;
  version: string;
  versionKey: string;

  risk: PackageRisk;

  blastRadius: {
    affectedServices: number;
    productionServices: number;
    services: BlastRadiusService[];
  };

  attackPaths: {
    affectedServices: number;
    paths: AttackPath[];
  };
}

export async function getSecurityAnalysis(
  versionKey: string,
  maxDepth = 5,
): Promise<SecurityAnalysis> {
  if (maxDepth < 0) {
    throw new Error(
      "maxDepth must be >= 0",
    );
  }

  /*
   * Expected:
   *
   * npm:axios@1.7.2
   *
   * Extract:
   *
   * packageName = axios
   * version     = 1.7.2
   */

  const npmPrefix = "npm:";

  if (!versionKey.startsWith(npmPrefix)) {
    throw new Error(
      `Unsupported version key: ${versionKey}`,
    );
  }

  const packageVersion =
    versionKey.slice(
      npmPrefix.length,
    );

  const separator =
    packageVersion.lastIndexOf("@");

  if (
    separator <= 0 ||
    separator ===
      packageVersion.length - 1
  ) {
    throw new Error(
      `Invalid npm version key: ${versionKey}`,
    );
  }

  const packageName =
    packageVersion.slice(
      0,
      separator,
    );

  const version =
    packageVersion.slice(
      separator + 1,
    );

  /*
   * ----------------------------------------------------------
   * Run security analysis
   * ----------------------------------------------------------
   */

  const [
    risk,
    blastRadius,
    attackPaths,
  ] = await Promise.all([
    getPackageRisk(
      versionKey,
      maxDepth,
    ),

    getBlastRadius(
      versionKey,
      maxDepth,
    ),

    getAttackPaths(
      versionKey,
      maxDepth,
    ),
  ]);

  /*
   * ----------------------------------------------------------
   * Production services
   * ----------------------------------------------------------
   */

  const productionServices =
    blastRadius.filter(
      (service) =>
        service.environment
          ?.toLowerCase() ===
        "production",
    ).length;

  /*
   * ----------------------------------------------------------
   * Return unified result
   * ----------------------------------------------------------
   */

  return {
    packageName,
    version,
    versionKey,

    risk,

    blastRadius: {
      affectedServices:
        blastRadius.length,

      productionServices,

      services:
        blastRadius,
    },

    attackPaths: {
      affectedServices:
        attackPaths.length,

      paths:
        attackPaths,
    },
  };
}