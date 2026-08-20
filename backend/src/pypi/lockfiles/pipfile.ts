/**
 * Pipfile.lock Parser
 *
 * Parses Pipfile.lock (JSON format) into normalized dependencies.
 *
 * Pipfile.lock format:
 *   {
 *     "default": {
 *       "requests": {
 *         "hashes": [...],
 *         "version": "==2.31.0"
 *       },
 *       ...
 *     },
 *     "develop": { ... }
 *   }
 */

import { readFile } from "node:fs/promises";

export interface PipfileEntry {
  name: string;
  version: string;
  dev: boolean;
}

function normalizePkgName(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, "-");
}

interface PipfileLock {
  default?: Record<
    string,
    { version?: string; hashes?: string[] }
  >;
  develop?: Record<
    string,
    { version?: string; hashes?: string[] }
  >;
}

export async function parsePipfileLock(
  path: string,
): Promise<PipfileEntry[]> {
  const raw = await readFile(path, "utf8");
  const lockfile = JSON.parse(raw) as PipfileLock;
  const entries: PipfileEntry[] = [];

  // Parse default dependencies
  if (lockfile.default) {
    for (const [name, meta] of Object.entries(
      lockfile.default,
    )) {
      if (!meta.version) continue;

      // Version format: "==1.2.3"
      const version = meta.version.replace(/^==/, "");

      entries.push({
        name: normalizePkgName(name),
        version,
        dev: false,
      });
    }
  }

  // Parse develop dependencies
  if (lockfile.develop) {
    for (const [name, meta] of Object.entries(
      lockfile.develop,
    )) {
      if (!meta.version) continue;

      const version = meta.version.replace(/^==/, "");

      entries.push({
        name: normalizePkgName(name),
        version,
        dev: true,
      });
    }
  }

  return entries;
}
