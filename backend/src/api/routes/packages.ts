import {
  packageInfo,
} from "../../graph/graph-service";

import {
  errorResponse,
  json,
} from "../response";

export async function packageRoute(
  packageName: string,
): Promise<Response> {
  if (!packageName) {
    return errorResponse(
      "Package name is required",
      400,
    );
  }

  try {
    const result = await packageInfo(packageName);

    if (result.versions.length === 0) {
      return errorResponse(
        `Package '${packageName}' not found`,
        404,
      );
    }

    return json(result);
  } catch (error) {
    console.error(
      "Package lookup failed:",
      error,
    );

    return errorResponse(
      "Failed to query package",
      500,
    );
  }
}