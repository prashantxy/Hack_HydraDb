import {
  getSecurityAnalysis,
} from "../../graph/query/analysis";

import {
  errorResponse,
} from "../response";

export async function analysisRoute(
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

    const analysis =
      await getSecurityAnalysis(
        versionKey,
        maxDepth,
      );

    return Response.json({
      ...analysis,
      maxDepth,
    });
  } catch (error) {
    console.error(
      "Security analysis error:",
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

    if (
      message.startsWith(
        "Invalid npm version key:",
      ) ||
      message.startsWith(
        "Unsupported version key:",
      )
    ) {
      return errorResponse(
        message,
        400,
      );
    }

    return errorResponse(
      "Failed to calculate security analysis",
      500,
    );
  }
}