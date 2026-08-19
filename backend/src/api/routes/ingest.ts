import { ingestPackage } from "../../npm/ingest";
import { errorResponse } from "../response";

export async function ingestPackageRoute(
  packageName: string,
  version: string,
  depth?: string,
): Promise<Response> {
  try {
    const maxDepth =
      depth === undefined
        ? 2
        : Number(depth);

    if (
      !Number.isInteger(maxDepth) ||
      maxDepth < 0
    ) {
      return errorResponse(
        "Depth must be a non-negative integer",
        400,
      );
    }

    const stats =
      await ingestPackage({
        packageName,
        version,
        maxDepth,
        concurrency: 5,
      });

    return new Response(
      JSON.stringify({
        success: true,
        packageName,
        version,
        versionKey:
          `npm:${packageName}@${version}`,
        stats,
      }),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json",
          "Access-Control-Allow-Origin":
            "*",
        },
      },
    );
  } catch (error) {
    console.error(
      "Package ingestion failed:",
      error,
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Package ingestion failed",
      500,
    );
  }
}