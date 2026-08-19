import {
  getPackageRisk,
} from "../../graph/query/risk";

import {
  errorResponse,
} from "../response";

export async function riskRoute(
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

    const risk =
      await getPackageRisk(
        versionKey,
        maxDepth,
      );

    return Response.json({
      ...risk,
      maxDepth,
    });
  } catch (error) {
    console.error(
      "Risk calculation error:",
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
      "Failed to calculate risk",
      500,
    );
  }
}