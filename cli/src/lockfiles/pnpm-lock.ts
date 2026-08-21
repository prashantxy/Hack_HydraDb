import { readFile } from "node:fs/promises";

import type { Dependency } from "./npm";

/*
 * ============================================================
 * pnpm-lock.yaml parser
 * ============================================================
 *
 * Supports the three layouts seen in the wild:
 *
 * v5 (lockfileVersion: 5.x)
 *   packages:
 *     /axios/1.7.2:
 *       resolution: {integrity: sha512-...}
 *
 * v6 (lockfileVersion: 6.0)
 *   packages:
 *     /axios@1.7.2:
 *       resolution: {integrity: sha512-...}
 *
 * v9 (lockfileVersion: 9.0)
 *   packages:
 *     axios@1.7.2:
 *       resolution: {integrity: sha512-...}
 *   snapshots:
 *     axios@1.7.2(peer-hash):
 *       dependencies: {...}
 *
 * The file is parsed line-by-line instead of pulling in a
 * YAML dependency — only package entry keys matter here.
 */

interface ParsedEntry {
  name: string;
  version: string;
}

/**
 * Extract name@version from a pnpm package key.
 *
 * Examples:
 *   axios@1.7.2                → axios / 1.7.2
 *   @babel/core@7.24.0         → @babel/core / 7.24.0
 *   /axios/1.7.2               → axios / 1.7.2
 *   /@types/node@20.0.0        → @types/node / 20.0.0
 *   axios@1.7.2(peer_hash)     → axios / 1.7.2
 */
function parseEntryKey(
  rawKey: string,
): ParsedEntry | null {
  let key = rawKey.trim();

  // Strip surrounding quotes if present
  key = key.replace(/^["']|["']$/g, "");

  // Strip peer-dependency suffixes: axios@1.7.2(foo_bar)
  key = key.replace(/\([^)]*\)$/, "");

  // Strip leading registry slash (v5/v6)
  const hadLeadingSlash = key.startsWith("/");
  if (hadLeadingSlash) {
    key = key.slice(1);
  }

  // Skip local / git / URL dependencies
  if (
    key.startsWith("file:") ||
    key.startsWith("link:") ||
    key.includes("://")
  ) {
    return null;
  }

  /*
   * v5 layout splits name and version with slashes:
   *   axios/1.7.2
   *   @types/node/20.0.0
   */
  if (hadLeadingSlash && key.includes("/")) {
    const lastSlash = key.lastIndexOf("/");

    const version = key.slice(lastSlash + 1);
    const name = key.slice(0, lastSlash);

    if (!name || !version || version.includes("/")) {
      return null;
    }

    return { name, version };
  }

  /*
   * v6/v9 layout joins them with @:
   *   axios@1.7.2
   *   @types/node@20.0.0
   */
  const atIndex = key.lastIndexOf("@");

  if (atIndex <= 0) {
    return null;
  }

  const name = key.slice(0, atIndex);
  const version = key.slice(atIndex + 1);

  if (!name || !version) {
    return null;
  }

  // Skip aliased specs like "foo@npm:bar@1.0.0"
  if (version.includes(":")) {
    return null;
  }

  return { name, version };
}

export async function parsePnpmLockfile(
  path: string,
): Promise<Dependency[]> {
  const raw =
    await readFile(path, "utf8");

  const lines = raw.split(/\r?\n/);

  const result =
    new Map<string, Dependency>();

  /*
   * Track which top-level section we are in.
   * Only `packages:` and `snapshots:` contain
   * resolvable package entries.
   */
  let section: string | null = null;

  for (const line of lines) {
    // Top-level section header (no indentation)
    if (/^[^\s#][^:]*:\s*$/.test(line)) {
      section = line.slice(
        0,
        line.indexOf(":"),
      ).trim();

      continue;
    }

    // Blank lines and comments carry no entries
    if (
      line.length === 0 ||
      line.startsWith("#")
    ) {
      continue;
    }

    if (
      section !== "packages" &&
      section !== "snapshots"
    ) {
      continue;
    }

    /*
     * Package entries sit at exactly two-space
     * indentation under their section:
     *
     *   axios@1.7.2:
     */
    const entryMatch = line.match(
      /^ {2}([^ ].*):\s*$/,
    );

    if (!entryMatch) {
      continue;
    }

    const parsed = parseEntryKey(
      entryMatch[1],
    );

    if (!parsed) {
      continue;
    }

    const dedupeKey =
      `${parsed.name}@${parsed.version}`;

    if (!result.has(dedupeKey)) {
      result.set(dedupeKey, {
        name: parsed.name,
        version: parsed.version,
        source: "lockfile",
        dev: false,
      });
    }
  }

  return Array.from(result.values());
}
