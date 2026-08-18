import {
  getBlastRadius,
} from "../../graph/query/blast-radius";

import {
  errorResponse,
} from "../response";

export async function blastRadiusRoute(
  versionKey: string,
  depth?: string,
): Promise<Response> {
  try {
    const maxDepth =
      depth === undefined
        ? 5
        : Number(depth);

    if (
      !Number.isInteger(maxDepth) ||
      maxDepth < 0
    ) {
      return errorResponse(
        "depth must be a non-negative integer",
        400,
      );
    }

    const services =
      await getBlastRadius(
        versionKey,
        maxDepth,
      );

    return Response.json({
      version: versionKey,
      maxDepth,
      affectedServices: services.length,
      services,
    });
  } catch (error) {
    console.error(
      "Blast radius error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    if (
      message.startsWith(
        "Version not found:",
      )
    ) {
      return errorResponse(
        message,
        404,
      );
    }

    return errorResponse(
      "Failed to calculate blast radius",
      500,
    );
  }
}