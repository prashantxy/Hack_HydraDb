import { hydraQuery } from "../../hydra/client";
import { cleanHydraRows } from "../../hydra/rows";

export interface CoMaintainerResult {
  packageName: string;
  sharedMaintainers: string[];
  sharedCount: number;
}

/**
 * Given a version key (e.g. "npm:axios@1.7.2"), find all packages
 * that share at least one maintainer with the package.
 *
 * Uses two simple queries instead of a complex variable-length match
 * to be compatible with HydraDB's OpenCypher engine.
 */
export async function getCoMaintainers(
  versionKey: string,
): Promise<CoMaintainerResult[]> {
  // Step 1: Find maintainers of the target package
  // Graph direction: (pkg:Package)-[:HAS_VERSION]->(v:Version)
  const maintainersResult = await hydraQuery(
    `
      MATCH (pkg:Package)-[:HAS_VERSION]->(v:Version {key: $key})
      MATCH (m:Maintainer)-[:MAINTAINS]->(pkg)
      RETURN m.username AS username, m.id AS mid
    `,
    {
      params: { key: versionKey },
    },
  );

  const maintainerRows = cleanHydraRows<{ username: unknown; mid: unknown }>(
    ["username", "mid"],
    maintainersResult.rows,
  );

  if (maintainerRows.length === 0) {
    return [];
  }

  const maintainerIds = maintainerRows.map((r) => Number(r.mid));

  // Step 2: Find all packages those maintainers also maintain
  const coMaintainedMap = new Map<string, Set<string>>();

  for (const mId of maintainerIds) {
    const username = maintainerRows.find((r) => Number(r.mid) === mId);
    if (!username) continue;

    const packagesResult = await hydraQuery(
      `
        MATCH (m:Maintainer {id: $mid})-[:MAINTAINS]->(pkg:Package)
        RETURN pkg.name AS name
      `,
      {
        params: { mid: mId },
      },
    );

    const pkgRows = cleanHydraRows<{ name: unknown }>(
      ["name"],
      packagesResult.rows,
    );

    for (const row of pkgRows) {
      const pkgName = String(row.name);
      if (!coMaintainedMap.has(pkgName)) {
        coMaintainedMap.set(pkgName, new Set());
      }
      coMaintainedMap.get(pkgName)!.add(String(username.username));
    }
  }

  // Filter out the original package and build results
  const originalPkg = maintainerRows.length > 0
    ? await hydraQuery(
        `
          MATCH (pkg:Package)-[:HAS_VERSION]->(v:Version {key: $key})
          RETURN pkg.name AS name
        `,
        { params: { key: versionKey } },
      )
    : null;

  let originalName = "";
  if (originalPkg && originalPkg.rows.length > 0) {
    originalName = String(originalPkg.rows[0][0]?.value ?? "");
  }

  const results: CoMaintainerResult[] = [];

  for (const [pkgName, maintainers] of coMaintainedMap) {
    if (pkgName === originalName) continue;

    results.push({
      packageName: pkgName,
      sharedMaintainers: Array.from(maintainers),
      sharedCount: maintainers.size,
    });
  }

  return results.sort(
    (a, b) => b.sharedCount - a.sharedCount || a.packageName.localeCompare(b.packageName),
  );
}
