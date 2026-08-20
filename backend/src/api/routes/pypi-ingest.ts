import { ingestPyPIPackage } from "../../pypi/ingest";
import { errorResponse, json } from "../response";

export async function pypiIngestRoute(
  packageName: string,
  version: string,
  depth?: string,
): Promise<Response> {
  try {
    const maxDepth =
      depth === undefined ? 2 : Number(depth);

    if (!Number.isInteger(maxDepth) || maxDepth < 0) {
      return errorResponse(
        "Depth must be a non-negative integer",
        400,
      );
    }

    const stats = await ingestPyPIPackage({
      packageName,
      version,
      maxDepth,
      concurrency: 5,
    });

    return json({
      success: true,
      packageName,
      version,
      versionKey: `pypi:${packageName}@${version}`,
      stats,
    });
  } catch (error) {
    console.error("PyPI ingestion failed:", error);

    return errorResponse(
      error instanceof Error
        ? error.message
        : "PyPI package ingestion failed",
      500,
    );
  }
}
