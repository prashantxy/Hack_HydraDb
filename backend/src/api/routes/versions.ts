import {
  packageDependencies,
} from "../../graph/graph-service";

import {
  errorResponse,
  json,
} from "../response";

export async function versionDependenciesRoute(
  versionKey: string,
): Promise<Response> {
  if (!versionKey) {
    return errorResponse(
      "Version key is required",
      400,
    );
  }

  try {
    const dependencies =
      await packageDependencies(versionKey);

    return json({
      version: versionKey,
      dependencies,
    });
  } catch (error) {
    console.error(
      "Dependency lookup failed:",
      error,
    );

    return errorResponse(
      "Failed to query dependencies",
      500,
    );
  }
}