/**
 * PyPI Package Normalizer
 *
 * Converts PyPI version metadata into the same NormalizedPackageVersion
 * format used by the npm pipeline, so the ingestion and graph write
 * code can be shared.
 */

import type { PyPIVersionInfo } from "./registry";

export interface NormalizedDependency {
  name: string;
  range: string;
  type: "runtime" | "optional" | "peer";
}

export interface NormalizedPackageVersion {
  key: string;
  packageName: string;
  version: string;
  dependencies: NormalizedDependency[];
  maintainers: string[];
}

// ── PEP 508 dependency string parser ──────────────────────────
//
// Examples:
//   requests>=2.20
//   flask[extra1,extra2]>=2.0
//   numpy; python_version>="3.8"
//   package @ https://example.com/package.tar.gz

interface ParsedDep {
  name: string;
  extras: string[];
  versionSpec: string;
  marker: string | null;
}

function parsePep508(raw: string): ParsedDep {
  let s = raw.trim();

  // Strip environment markers (everything after ";")
  let marker: string | null = null;
  const markerIdx = s.indexOf(";");
  if (markerIdx !== -1) {
    marker = s.slice(markerIdx + 1).trim();
    s = s.slice(0, markerIdx).trim();
  }

  // Strip URL requirement (@ https://...)
  if (s.includes("@")) {
    const atIdx = s.indexOf("@");
    const namePart = s.slice(0, atIdx).trim();
    return {
      name: normalizePkgName(namePart),
      extras: [],
      versionSpec: "",
      marker,
    };
  }

  // Strip extras [extra1,extra2]
  let extras: string[] = [];
  const bracketStart = s.indexOf("[");
  if (bracketStart !== -1) {
    const bracketEnd = s.indexOf("]", bracketStart);
    if (bracketEnd !== -1) {
      const extrasStr = s.slice(bracketStart + 1, bracketEnd);
      extras = extrasStr.split(",").map((e) => e.trim());
      s = s.slice(0, bracketStart) + s.slice(bracketEnd + 1);
    }
  }

  // Split name from version spec
  // Version specifiers: ==, >=, <=, !=, ~=, >, <
  const specMatch = s.match(
    /^([A-Za-z0-9_.-]+)\s*(.*)$/,
  );

  if (!specMatch) {
    return { name: s, extras, versionSpec: "", marker };
  }

  return {
    name: normalizePkgName(specMatch[1]),
    extras,
    versionSpec: specMatch[2].trim(),
    marker,
  };
}

function normalizePkgName(name: string): string {
  return (name ?? "").trim().toLowerCase().replace(/_/g, "-");
}

/**
 * Convert PyPI requires_dist entries to NormalizedDependency[].
 *
 * requires_dist examples:
 *   ["requests>=2.20", "flask; python_version>='3.8'", "urllib3>=1.24"]
 */
function parseRequiresDist(
  requiresDist: string[] | null,
): NormalizedDependency[] {
  if (!requiresDist) return [];

  const deps: NormalizedDependency[] = [];

  for (const raw of requiresDist) {
    const parsed = parsePep508(raw);

    // Skip "extra ==" conditional dependencies for now
    // These are extras, not core dependencies
    if (
      parsed.marker?.includes("extra ==") ||
      parsed.marker?.includes("extra==")
    ) {
      continue;
    }

    // Skip test/dev dependencies
    if (
      parsed.marker?.includes("extra ==") ||
      parsed.marker?.includes("testing")
    ) {
      continue;
    }

    deps.push({
      name: parsed.name,
      range: parsed.versionSpec || "*",
      type: "runtime",
    });
  }

  return deps;
}

// ── Maintainer extraction ─────────────────────────────────────

function extractMaintainers(info: PyPIVersionInfo): string[] {
  const maintainers: string[] = [];

  if (info.maintainer) {
    maintainers.push(info.maintainer);
  }

  if (info.author && info.author !== info.maintainer) {
    maintainers.push(info.author);
  }

  // Deduplicate
  return [...new Set(maintainers)];
}

// ── Main normalizer ───────────────────────────────────────────

export function normalizePyPIVersion(
  info: PyPIVersionInfo,
): NormalizedPackageVersion {
  const packageName = normalizePkgName(info.name);
  const version = info.version;
  const key = `pypi:${packageName}@${version}`;

  const dependencies = parseRequiresDist(info.requires_dist);
  const maintainers = extractMaintainers(info);

  return {
    packageName,
    version,
    key,
    dependencies,
    maintainers,
  };
}
