/**
 * poetry.lock Parser
 *
 * Parses Poetry lockfiles (TOML format) into normalized dependencies.
 *
 * poetry.lock format:
 *   [[package]]
 *   name = "requests"
 *   version = "2.31.0"
 *   ...
 *   [package.dependencies]
 *   charset-normalizer = ">=2,<4"
 *   idna = ">=2.5,<4"
 *   ...
 */

import { readFile } from "node:fs/promises";

export interface PoetryEntry {
  name: string;
  version: string;
}

function normalizePkgName(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, "-");
}

/**
 * Parse a poetry.lock file.
 *
 * We use a simple regex-based approach since we don't want
 * to pull in a TOML parser dependency.
 */
export async function parsePoetryLock(
  path: string,
): Promise<PoetryEntry[]> {
  const raw = await readFile(path, "utf8");
  const entries: PoetryEntry[] = [];

  // Split by [[package]] sections
  const sections = raw.split(/\[\[package\]\]/);

  for (const section of sections) {
    // Extract name
    const nameMatch = section.match(
      /^\s*name\s*=\s*"([^"]+)"/m,
    );
    if (!nameMatch) continue;

    // Extract version
    const versionMatch = section.match(
      /^\s*version\s*=\s*"([^"]+)"/m,
    );
    if (!versionMatch) continue;

    entries.push({
      name: normalizePkgName(nameMatch[1]),
      version: versionMatch[1],
    });
  }

  return entries;
}
