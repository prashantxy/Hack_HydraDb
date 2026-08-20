import { getCoMaintainers } from "../../graph/query/co-maintainers";
import { errorResponse, json } from "../response";

export async function coMaintainersRoute(
  versionKey: string,
): Promise<Response> {
  try {
    const coMaintainers =
      await getCoMaintainers(versionKey);

    return json({
      version: versionKey,
      coMaintainerCount: coMaintainers.length,
      packages: coMaintainers,
    });
  } catch (error) {
    console.error(
      "Co-maintainer lookup failed:",
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
      return errorResponse(message, 404);
    }

    return errorResponse(
      "Failed to query co-maintainers",
      500,
    );
  }
}
