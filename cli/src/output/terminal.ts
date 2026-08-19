export function printBanner() {
  console.log(`
╔══════════════════════════════════════════╗
║              CHAINTRACE                  ║
║     Software Supply Chain Security       ║
╚══════════════════════════════════════════╝
`);
}

export function printScanSummary(
  lockfile: string,
  total: number,
  results: any[],
) {
  console.log("");
  console.log(`Lockfile: ${lockfile}`);
  console.log(
    `Dependencies: ${total}`,
  );

  console.log("");

  const dangerous =
    results.filter(
      (x) =>
        x.risk.severity === "CRITICAL" ||
        x.risk.severity === "HIGH",
    );

  console.log(
    `Analyzed: ${results.length}`,
  );

  console.log(
    `High risk: ${dangerous.length}`,
  );

  console.log("");

  for (const result of results) {
    const severity =
      result.risk.severity;

    const symbol =
      severity === "CRITICAL"
        ? "🔴"
        : severity === "HIGH"
          ? "🟠"
          : severity === "MEDIUM"
            ? "🟡"
            : "🟢";

    console.log(
      `${symbol} ${result.packageName}@${result.version}`,
    );

    console.log(
      `   Risk: ${result.risk.score}/100 ${severity}`,
    );

    console.log(
      `   Services affected: ${result.blastRadius.affectedServices}`,
    );

    console.log(
      `   Production: ${result.blastRadius.productionServices}`,
    );

    console.log("");
  }
}

export function printPackageAnalysis(
  result: any,
) {
  console.log("");

  console.log(
    `Package: ${result.packageName}@${result.version}`,
  );

  console.log(
    `Version Key: ${result.versionKey}`,
  );

  console.log("");

  console.log(
    `Risk: ${result.risk.score}/100`,
  );

  console.log(
    `Severity: ${result.risk.severity}`,
  );

  console.log("");

  console.log(
    `Affected services: ${result.blastRadius.affectedServices}`,
  );

  console.log(
    `Production services: ${result.blastRadius.productionServices}`,
  );

  console.log("");

  console.log("Attack paths:");

  for (
    const path
    of result.attackPaths.paths
  ) {
    console.log(
      `  ${path.serviceName}`,
    );

    console.log(
      `    environment: ${path.environment}`,
    );

    console.log(
      `    hops: ${path.hops}`,
    );

    console.log(
      `    ${path.path.join(" → ")}`,
    );
  }

  console.log("");
}