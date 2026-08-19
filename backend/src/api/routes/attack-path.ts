import {
  getAttackPaths,
} from "../../graph/query/attack-path";

import {
  errorResponse,
} from "../response";

export async function attackPathRoute(
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

    const paths =
      await getAttackPaths(
        versionKey,
        maxDepth,
      );

    return Response.json({
      version: versionKey,
      maxDepth,
      affectedServices:
        paths.length,
      attackPaths: paths,
    });
  } catch (error) {
    console.error(
      "Attack path error:",
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
      "Failed to calculate attack paths",
      500,
    );
  }
}