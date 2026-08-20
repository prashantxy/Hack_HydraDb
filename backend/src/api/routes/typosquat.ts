import { detectTyposquats } from "../../graph/query/typosquat";
import { errorResponse, json } from "../response";

export async function typosquatRoute(
  packageName: string,
  threshold?: string,
): Promise<Response> {
  try {
    const maxDistance =
      threshold === undefined
        ? 2
        : Number(threshold);

    if (
      !Number.isInteger(maxDistance) ||
      maxDistance < 1 ||
      maxDistance > 5
    ) {
      return errorResponse(
        "threshold must be an integer between 1 and 5",
        400,
      );
    }

    const result = await detectTyposquats(
      packageName,
      maxDistance,
    );

    return json(result);
  } catch (error) {
    console.error(
      "Typosquat detection failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return errorResponse(
      message || "Failed to detect typosquats",
      500,
    );
  }
}
