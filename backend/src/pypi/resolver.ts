/**
 * PyPI Version Resolver
 *
 * Given a package name and a PEP 440 version specifier (e.g. ">=2.0,<3.0"),
 * resolve to the latest matching concrete version from PyPI.
 */

import { fetchPyPIPackage } from "./registry";

/**
 * Parse a PEP 440 version specifier and check if a version satisfies it.
 *
 * Supports: ==, !=, >=, <=, >, <, ~=
 */
function satisfiesSpec(
  version: string,
  spec: string,
): boolean {
  // Handle "*"
  if (spec === "*" || spec === "") return true;

  // Split multiple specs: ">=2.0,<3.0"
  const specs = spec.split(",").map((s) => s.trim());

  for (const s of specs) {
    if (!matchSingleSpec(version, s)) {
      return false;
    }
  }

  return true;
}

function matchSingleSpec(
  version: string,
  spec: string,
): boolean {
  // ~=
  const tildeEq = spec.match(/^~=(.+)$/);
  if (tildeEq) {
    const target = tildeEq[1];
    // ~= X.Y is equivalent to >= X.Y, == X.*
    // ~= X.Y.Z is equivalent to >= X.Y.Z, == X.Y.*
    const parts = target.split(".");
    if (parts.length >= 2) {
      const prefix = parts.slice(0, -1).join(".");
      return (
        compareVersions(version, target) >= 0 &&
        version.startsWith(prefix + ".")
      );
    }
    return compareVersions(version, target) >= 0;
  }

  // >=
  const gte = spec.match(/^>=(.+)$/);
  if (gte) {
    return compareVersions(version, gte[1]) >= 0;
  }

  // >
  const gt = spec.match(/^>(.+)$/);
  if (gt) {
    return compareVersions(version, gt[1]) > 0;
  }

  // <=
  const lte = spec.match(/^<=(.+)$/);
  if (lte) {
    return compareVersions(version, lte[1]) <= 0;
  }

  // <
  const lt = spec.match(/^<(.+)$/);
  if (lt) {
    return compareVersions(version, lt[1]) < 0;
  }

  // !=
  const neq = spec.match(/^!=(.+)$/);
  if (neq) {
    return version !== neq[1];
  }

  // == (exact or prefix)
  const eq = spec.match(/^==(.+)$/);
  if (eq) {
    const target = eq[1];
    if (target.endsWith(".*")) {
      const prefix = target.slice(0, -2);
      return version.startsWith(prefix + ".");
    }
    return version === target;
  }

  // Default: try exact match
  return version === spec;
}

/**
 * Simple version comparison: split by "." and compare numerically.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);

  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }

  return 0;
}

/**
 * Filter out pre-release versions.
 */
function isPreRelease(version: string): boolean {
  return (
    version.includes("a") ||
    version.includes("b") ||
    version.includes("rc") ||
    version.includes("dev") ||
    version.includes("alpha") ||
    version.includes("beta")
  );
}

/**
 * Resolve a PEP 440 version specifier to a concrete version.
 *
 * Fetches all versions from PyPI and returns the latest
 * matching non-pre-release version.
 */
export async function resolvePyPIVersion(
  packageName: string,
  range: string,
): Promise<string> {
  const pkg = await fetchPyPIPackage(packageName);
  const versions = Object.keys(pkg.releases).filter(
    (v) => !isPreRelease(v),
  );

  if (versions.length === 0) {
    throw new Error(
      `No stable versions found for ${packageName}`,
    );
  }

  const matching = versions.filter((v) =>
    satisfiesSpec(v, range),
  );

  if (matching.length === 0) {
    throw new Error(
      `Could not resolve ${packageName}@${range}`,
    );
  }

  // Sort descending and pick the latest
  matching.sort((a, b) => compareVersions(b, a));

  return matching[0];
}
