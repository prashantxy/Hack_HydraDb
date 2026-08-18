import { hydraQuery } from "../../hydra/client";

export interface DependencyEdge {
  id: number;
  fromVersionId: number;
  toVersionId: number;
  packageName: string;
  versionRange: string;
  dependencyType: "runtime" | "optional" | "peer";
}

export async function createDependencyEdges(
  edges: DependencyEdge[],
): Promise<void> {
  if (edges.length === 0) {
    return;
  }

  const query = `
    UNWIND $rows AS row

    MATCH
      (source:Version {id: row.fromVersionId}),
      (target:Version {id: row.toVersionId})

    MERGE
      (source)-[
        r:DEPENDS_ON {id: row.id}
      ]->(target)

    SET
      r.packageName = row.packageName,
      r.versionRange = row.versionRange,
      r.dependencyType = row.dependencyType
  `;

  await hydraQuery(query, {
    params: {
      rows: edges,
    },
  });
}