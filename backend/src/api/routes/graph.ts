import {
  packageGraph,
} from "../../graph/graph-service";

import {
  errorResponse,
  json,
} from "../response";

export async function graphRoute(
  packageName: string,
  depthParam?: string,
): Promise<Response> {
  if (!packageName) {
    return errorResponse(
      "Package name is required",
      400,
    );
  }

  let depth = 1;

  if (depthParam !== undefined) {
    depth = Number(depthParam);

    if (
      !Number.isInteger(depth) ||
      depth < 1 ||
      depth > 5
    ) {
      return errorResponse(
        "depth must be an integer between 1 and 5",
        400,
      );
    }
  }

  try {
    const graph =
      await packageGraph(
        packageName,
        depth,
      );

    if (graph.nodes.length === 0) {
      return errorResponse(
        `Package '${packageName}' not found`,
        404,
      );
    }

    return json(graph);
  } catch (error) {
    console.error(
      "Graph lookup failed:",
      error,
    );

    return errorResponse(
      "Failed to query package graph",
      500,
    );
  }
}