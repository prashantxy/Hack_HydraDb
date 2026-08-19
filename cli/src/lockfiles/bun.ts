import { readFile } from "node:fs/promises";

export interface Dependency {
  name: string;
  version: string;
  source: "lockfile";
  dev: boolean;
  resolved?: string;
  integrity?: string;
}

/**
 * Bun lockfile v1/v2-ish structure.
 *
 * Bun has changed its lockfile representation across versions,
 * so we intentionally keep this parser defensive.
 */
interface BunLockfile {
  packages?: Record<
    string,
    unknown
  >;

  workspaces?: Record<
    string,
    unknown
  >;

  [key: string]: unknown;
}

/**
 * Remove JSONC comments.
 *
 * bun.lock may contain comments depending on
 * the Bun version / generated format.
 */
function stripJsonComments(
  input: string,
): string {
  return input
    .replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    )
    .replace(
      /(^|[^:])\/\/.*$/gm,
      "$1",
    );
}

/**
 * Remove trailing commas before } or ].
 */
function removeTrailingCommas(
  input: string,
): string {
  return input.replace(
    /,\s*([}\]])/g,
    "$1",
  );
}

function normalizeVersion(
  value: unknown,
): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    return String(value);
  }

  return null;
}

function extractVersion(
  metadata: unknown,
): string | null {
  if (
    typeof metadata === "string"
  ) {
    return metadata;
  }

  if (
    typeof metadata !== "object" ||
    metadata === null
  ) {
    return null;
  }

  const record =
    metadata as Record<
      string,
      unknown
    >;

  /*
   * Different Bun lockfile formats may
   * expose version information differently.
   */
  const candidates = [
    record.version,
    record.resolvedVersion,
  ];

  for (
    const candidate of candidates
  ) {
    const version =
      normalizeVersion(candidate);

    if (version) {
      return version;
    }
  }

  /*
   * Some Bun structures represent a package
   * as:
   *
   * "axios": ["axios@1.7.2", ...]
   *
   * or:
   *
   * "axios": "axios@1.7.2"
   */

  return null;
}

function extractPackageName(
  key: string,
): string {
  /*
   * Examples:
   *
   * axios
   * react
   * @types/node
   * @babel/core
   */

  return key
    .replace(
      /^node_modules\//,
      "",
    )
    .replace(
      /^registry\.npmjs\.org\//,
      "",
    );
}

function extractVersionFromString(
  value: string,
): string | null {
  /*
   * axios@1.7.2
   *
   * @scope/pkg@1.2.3
   */

  const match =
    value.match(
      /(?:^|\/)(@[^/]+\/[^@]+|[^@/]+)@(\d+\.\d+\.\d+(?:[-+][^/\s]+)?)$/,
    );

  if (!match) {
    return null;
  }

  return match[2] ?? null;
}

export async function parseBunLockfile(
  path: string,
): Promise<Dependency[]> {
  const raw =
    await readFile(
      path,
      "utf8",
    );

  let lockfile: BunLockfile;

  try {
    const normalized =
      removeTrailingCommas(
        stripJsonComments(raw),
      );

    lockfile =
      JSON.parse(
        normalized,
      ) as BunLockfile;
  } catch (error) {
    throw new Error(
      `Failed to parse bun.lock: ${
        error instanceof Error
          ? error.message
          : "invalid lockfile"
      }`,
    );
  }

  const result: Dependency[] =
    [];

  /*
   * ----------------------------------------------------------
   * Strategy 1: packages map
   * ----------------------------------------------------------
   */

  if (
    lockfile.packages &&
    typeof lockfile.packages ===
      "object"
  ) {
    for (
      const [
        packageKey,
        metadata,
      ] of Object.entries(
        lockfile.packages,
      )
    ) {
      const name =
        extractPackageName(
          packageKey,
        );

      let version =
        extractVersion(
          metadata,
        );

      /*
       * If metadata itself is something
       * like "axios@1.7.2", extract it.
       */

      if (
        !version &&
        typeof metadata ===
          "string"
      ) {
        version =
          extractVersionFromString(
            metadata,
          );
      }

      if (!version) {
        continue;
      }

      result.push({
        name,
        version,
        source: "lockfile",
        dev: false,
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * Strategy 2: recursively inspect lockfile
   * ----------------------------------------------------------
   *
   * This makes the parser resilient to Bun's
   * different lockfile representations.
   * ----------------------------------------------------------
   */

  const seen =
    new Set<string>();

  function walk(
    value: unknown,
    possibleName?: string,
  ): void {
    if (
      typeof value === "string"
    ) {
      if (!possibleName) {
        return;
      }

      const version =
        extractVersionFromString(
          value,
        );

      if (!version) {
        return;
      }

      const name =
        extractPackageName(
          possibleName,
        );

      const key =
        `${name}@${version}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      result.push({
        name,
        version,
        source: "lockfile",
        dev: false,
      });

      return;
    }

    if (
      typeof value !== "object" ||
      value === null
    ) {
      return;
    }

    if (Array.isArray(value)) {
      for (
        const item of value
      ) {
        walk(
          item,
          possibleName,
        );
      }

      return;
    }

    for (
      const [
        key,
        child,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      /*
       * Don't treat metadata fields as
       * package names.
       */
      if (
        key === "version" ||
        key === "integrity" ||
        key === "resolved" ||
        key === "dependencies" ||
        key === "packages"
      ) {
        walk(child);
        continue;
      }

      walk(
        child,
        key,
      );
    }
  }

  /*
   * Only use recursive fallback when
   * the primary parser found nothing.
   */
  if (result.length === 0) {
    walk(lockfile);
  }

  /*
   * ----------------------------------------------------------
   * Deduplicate
   * ----------------------------------------------------------
   */

  const unique =
    new Map<
      string,
      Dependency
    >();

  for (
    const dependency of result
  ) {
    const key =
      `${dependency.name}@${dependency.version}`;

    if (!unique.has(key)) {
      unique.set(
        key,
        dependency,
      );
    }
  }

  return Array.from(
    unique.values(),
  );
}