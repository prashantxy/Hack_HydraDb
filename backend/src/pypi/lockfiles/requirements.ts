/**
 * requirements.txt Parser
 *
 * Parses pip requirements files into normalized dependencies.
 *
 * Supported formats:
 *   package==1.2.3
 *   package>=1.0,<2.0
 *   package
 *   package[extra1,extra2]>=1.0
 *   -r other-requirements.txt   (recursive, skipped)
 *   -e git+https://...          (editable, skipped)
 *   # comment                   (skipped)
 *   package @ https://...       (URL, skipped)
 */

import { readFile } from "node:fs/promises";

export interface RequirementEntry {
  name: string;
  version: string;
  raw: string;
}

function normalizePkgName(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, "-");
}

function parseLine(line: string): RequirementEntry | null {
  let s = line.trim();

  // Skip empty lines, comments, options
  if (!s) return null;
  if (s.startsWith("#")) return null;
  if (s.startsWith("-")) return null;

  // Strip environment markers
  const markerIdx = s.indexOf(";");
  if (markerIdx !== -1) {
    s = s.slice(0, markerIdx).trim();
  }

  // Strip extras [extra1,extra2]
  const bracketStart = s.indexOf("[");
  if (bracketStart !== -1) {
    const bracketEnd = s.indexOf("]", bracketStart);
    if (bracketEnd !== -1) {
      s = s.slice(0, bracketStart) + s.slice(bracketEnd + 1);
    }
  }

  // URL requirement: package @ https://...
  if (s.includes("@")) {
    return null; // Skip URL requirements
  }

  // Split name from version spec
  // Handle ==, >=, <=, !=, ~=, >, <
  const specMatch = s.match(
    /^([A-Za-z0-9_.-]+)\s*(.*)$/,
  );

  if (!specMatch) return null;

  const name = normalizePkgName(specMatch[1]);
  const spec = specMatch[2].trim();

  // Extract exact version from == specifier
  const exactMatch = spec.match(/^==\s*(.+)/);
  if (exactMatch) {
    return {
      name,
      version: exactMatch[1].trim(),
      raw: line.trim(),
    };
  }

  // For non-exact specs, use the spec as version (will be resolved later)
  return {
    name,
    version: spec || "*",
    raw: line.trim(),
  };
}

export async function parseRequirementsTxt(
  path: string,
): Promise<RequirementEntry[]> {
  const raw = await readFile(path, "utf8");
  const lines = raw.split("\n");
  const entries: RequirementEntry[] = [];

  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}
