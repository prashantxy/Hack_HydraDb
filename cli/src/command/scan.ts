import {
  scanProject,
} from "../lockfiles/scan";

import {
  ensurePackage,
  type PackageRiskResponse,
} from "../api/client";

interface ScanOptions {
  path: string;
  depth: string;
}

function severityRank(
  severity: PackageRiskResponse["severity"],
): number {
  switch (severity) {
    case "CRITICAL":
      return 4;

    case "HIGH":
      return 3;

    case "MEDIUM":
      return 2;

    case "LOW":
      return 1;

    default:
      return 0;
  }
}

function printSeverity(
  severity: PackageRiskResponse["severity"],
): string {
  switch (severity) {
    case "CRITICAL":
      return "✗ CRITICAL";

    case "HIGH":
      return "⚠ HIGH";

    case "MEDIUM":
      return "⚠ MEDIUM";

    case "LOW":
      return "✓ LOW";

    default:
      return "? UNKNOWN";
  }
}

export async function scanCommand(
  options: ScanOptions,
): Promise<void> {
  const depth =
    Number(options.depth);

  if (
    !Number.isInteger(depth) ||
    depth < 0
  ) {
    throw new Error(
      "Depth must be a non-negative integer",
    );
  }

  console.log(
    `Scanning project: ${options.path}`,
  );

  const result =
    await scanProject(
      options.path,
    );

  console.log("");

  console.log(
    `Lockfile: ${result.lockfile.type}`,
  );

  console.log(
    `Path: ${result.lockfile.path}`,
  );

  console.log(
    `Dependencies found: ${result.dependencies.length}`,
  );

  console.log("");

  console.log(
    "Analyzing dependency risk...",
  );

  console.log("");

  const results: Array<{
    name: string;
    version: string;
    risk: PackageRiskResponse;
  }> = [];

  /*
   * ========================================================
   * ANALYZE DEPENDENCIES
   * ========================================================
   */

  for (
    const dependency
    of result.dependencies
  ) {
    process.stdout.write(
      `  ${dependency.name}@${dependency.version} ... `,
    );

    try {
      /*
       * ensurePackage() does:
       *
       * 1. Check whether package exists
       * 2. If missing, ingest it
       * 3. Analyze it again
       */

      const analysis =
        await ensurePackage(
          dependency.name,
          dependency.version,
          depth,
        );

      const risk =
        analysis.risk;

      results.push({
        name:
          dependency.name,

        version:
          dependency.version,

        risk,
      });

      console.log(
        `${printSeverity(
          risk.severity,
        )} (${risk.score}/100)`,
      );
    } catch (error) {
      console.log(
        "? unavailable",
      );

      if (
        process.env.CHAINTRACE_DEBUG
      ) {
        console.error(
          error instanceof Error
            ? error.message
            : error,
        );
      }
    }
  }

  /*
   * ========================================================
   * SORT
   * ========================================================
   */

  const sorted =
    [...results].sort(
      (a, b) =>
        severityRank(
          b.risk.severity,
        ) -
          severityRank(
            a.risk.severity,
          ) ||
        b.risk.score -
          a.risk.score,
    );

  /*
   * ========================================================
   * COUNTS
   * ========================================================
   */

  const critical =
    results.filter(
      (item) =>
        item.risk.severity ===
        "CRITICAL",
    );

  const high =
    results.filter(
      (item) =>
        item.risk.severity ===
        "HIGH",
    );

  const medium =
    results.filter(
      (item) =>
        item.risk.severity ===
        "MEDIUM",
    );

  const low =
    results.filter(
      (item) =>
        item.risk.severity ===
        "LOW",
    );

  /*
   * ========================================================
   * SUMMARY
   * ========================================================
   */

  console.log("");

  console.log(
    "════════════════════════════════════════",
  );

  console.log(
    "ChainTrace Security Summary",
  );

  console.log(
    "════════════════════════════════════════",
  );

  console.log("");

  console.log(
    `Dependencies analyzed: ${results.length}/${result.dependencies.length}`,
  );

  console.log(
    `Critical: ${critical.length}`,
  );

  console.log(
    `High:     ${high.length}`,
  );

  console.log(
    `Medium:   ${medium.length}`,
  );

  console.log(
    `Low:      ${low.length}`,
  );

  /*
   * ========================================================
   * TOP RISKS
   * ========================================================
   */

  if (sorted.length > 0) {
    console.log("");

    console.log(
      "Top risks:",
    );

    console.log("");

    for (
      const item of sorted.slice(
        0,
        10,
      )
    ) {
      console.log(
        `  ${printSeverity(
          item.risk.severity,
        )} ${item.name}@${item.version} — ${item.risk.score}/100`,
      );

      if (
        item.risk.affectedServices > 0
      ) {
        console.log(
          `      affected services: ${item.risk.affectedServices}`,
        );

        console.log(
          `      production services: ${item.risk.productionServices}`,
        );
      }
    }
  }

  /*
   * ========================================================
   * DASHBOARD
   * ========================================================
   */

  console.log("");

  console.log(
    "Dashboard:",
  );

  console.log(
    "http://localhost:3001",
  );

  /*
   * ========================================================
   * CI EXIT CODE
   * ========================================================
   */

  if (
    critical.length > 0
  ) {
    console.log("");

    console.log(
      "✗ CRITICAL supply-chain risks detected.",
    );

    process.exitCode = 2;
  } else if (
    high.length > 0
  ) {
    console.log("");

    console.log(
      "⚠ HIGH supply-chain risks detected.",
    );

    process.exitCode = 1;
  } else {
    console.log("");

    console.log(
      "✓ No high-risk dependencies detected.",
    );
  }
}