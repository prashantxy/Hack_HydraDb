import { hydraQuery } from "../../hydra/client";
import { cleanHydraRows } from "../../hydra/rows";

export interface TyposquatResult {
  targetPackage: string;
  threshold: number;
  candidates: Array<{
    packageName: string;
    editDistance: number;
    sharedPrefix: boolean;
    sharedSuffix: boolean;
    popularity: "high" | "medium" | "low" | "unknown";
    riskSignal: string;
  }>;
}

interface PackageRow {
  name: unknown;
}

// ── Levenshtein distance ──────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows for memory efficiency
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;

    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }

    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ── Scope handling ────────────────────────────────────────────

function scopeName(name: string): string {
  return name.startsWith("@") ? name.split("/")[1] ?? name : name;
}

// ── Popularity heuristics (based on name length/patterns) ─────

function classifyPopularity(name: string): "high" | "medium" | "low" | "unknown" {
  const unscoped = scopeName(name);

  // Well-known high-popularity indicators
  const popular = new Set([
    "lodash", "react", "express", "axios", "moment", "chalk",
    "commander", "uuid", "debug", "semver", "glob", "minimist",
    "rimraf", "mkdirp", "yargs", "inquirer", "ora", "dotenv",
    "body-parser", "cors", "helmet", "morgan", "jsonwebtoken",
    "bcrypt", "mongoose", "sequelize", "knex", "prisma",
    "next", "nuxt", "gatsby", "webpack", "vite", "esbuild",
    "typescript", "eslint", "prettier", "jest", "mocha", "vitest",
    "tailwindcss", "postcss", "sass", "less",
  ]);

  if (popular.has(unscoped)) return "high";

  // Medium: short, common-looking names
  if (unscoped.length <= 6) return "medium";

  // Low: longer, more specific names
  if (unscoped.length <= 12) return "low";

  return "unknown";
}

// ── Main function ─────────────────────────────────────────────

/**
 * Detect typosquatting candidates for a given package name.
 *
 * Strategy:
 * 1. Fetch all package names from the graph (sample if too many)
 * 2. Compute edit distance to the target name
 * 3. Filter by threshold (edit distance ≤ 2)
 * 4. Apply heuristics: shared prefix/suffix, popularity, risk signals
 */
export async function detectTyposquats(
  packageName: string,
  threshold: number = 2,
): Promise<TyposquatResult> {
  // Fetch all package names (limit to avoid memory issues)
  const result = await hydraQuery(
    `
      MATCH (p:Package)
      RETURN DISTINCT p.name AS name
    `,
    { params: {} },
  );

  const rows = cleanHydraRows<PackageRow>(["name"], result.rows);

  const allNames = rows.map((row) => String(row.name));

  // Compute edit distances and filter
  const candidates: TyposquatResult["candidates"] = [];

  const targetUnscoped = scopeName(packageName.toLowerCase());

  for (const name of allNames) {
    if (name === packageName) continue;

    const nameUnscoped = scopeName(name.toLowerCase());

    // Skip if same scoped name
    if (nameUnscoped === targetUnscoped && name !== packageName) {
      // Same unscoped name but different scope — interesting but not typosquat
      continue;
    }

    const dist = levenshtein(targetUnscoped, nameUnscoped);

    if (dist === 0) continue; // identical after normalization
    if (dist > threshold) continue;

    const sharedPrefix = targetUnscoped.slice(0, 3) === nameUnscoped.slice(0, 3);
    const sharedSuffix = targetUnscoped.slice(-3) === nameUnscoped.slice(-3);

    const popularity = classifyPopularity(name);

    // Build risk signal
    let riskSignal = "";
    if (dist === 1) {
      riskSignal = `Edit distance 1 — ${sharedPrefix ? "shared prefix" : sharedSuffix ? "shared suffix" : "differing characters"}`;
    } else if (dist === 2) {
      riskSignal = `Edit distance 2 — ${sharedPrefix && sharedSuffix ? "same start and end" : sharedPrefix ? "shared prefix" : sharedSuffix ? "shared suffix" : "differing characters"}`;
    } else {
      riskSignal = `Edit distance ${dist}`;
    }

    if (popularity === "high") {
      riskSignal += " · targets high-popularity package";
    }

    candidates.push({
      packageName: name,
      editDistance: dist,
      sharedPrefix,
      sharedSuffix,
      popularity,
      riskSignal,
    });
  }

  // Sort by edit distance (ascending), then by shared prefix/suffix
  candidates.sort((a, b) => {
    if (a.editDistance !== b.editDistance) return a.editDistance - b.editDistance;
    if (a.sharedPrefix !== b.sharedPrefix) return a.sharedPrefix ? -1 : 1;
    if (a.sharedSuffix !== b.sharedSuffix) return a.sharedSuffix ? -1 : 1;
    return a.packageName.localeCompare(b.packageName);
  });

  return {
    targetPackage: packageName,
    threshold,
    candidates,
  };
}
