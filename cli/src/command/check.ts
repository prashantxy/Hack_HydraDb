import {
  checkPackage,
} from "../api/client";

import {
  printPackageAnalysis,
} from "../output/terminal";

export async function checkCommand(
  packageSpec: string,
  depth = 5,
) {
  const separator =
    packageSpec.lastIndexOf("@");

  if (
    separator <= 0
  ) {
    throw new Error(
      "Expected package format: axios@1.7.2",
    );
  }

  const packageName =
    packageSpec.slice(
      0,
      separator,
    );

  const version =
    packageSpec.slice(
      separator + 1,
    );

  console.log(
    `Analyzing ${packageName}@${version}...`,
  );

  const result =
    await checkPackage(
      packageName,
      version,
      depth,
    );

  printPackageAnalysis(
    result,
  );

  const dashboardUrl = process.env.CHAINTRACE_DASHBOARD_URL ?? "http://localhost:3000";

  console.log(
    `Dashboard: ${dashboardUrl}/packages/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`,
  );
}