import {
  resolveLockfileEntries,
  type LockfileEntry,
} from "../../graph/query/lockfile-resolve";
import { errorResponse, json } from "../response";

export async function lockfileResolveRoute(
  req: Request,
): Promise<Response> {
  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return errorResponse(
        "Invalid request body",
        400,
      );
    }

    const compromisedVersion =
      typeof body.compromisedVersion === "string"
        ? body.compromisedVersion
        : "";

    if (!compromisedVersion) {
      return errorResponse(
        "compromisedVersion is required (e.g. 'npm:axios@1.7.2')",
        400,
      );
    }

    const entries: LockfileEntry[] = Array.isArray(
      body.entries,
    )
      ? body.entries
          .filter(
            (
              e: unknown,
            ): e is LockfileEntry =>
              typeof e === "object" &&
              e !== null &&
              typeof (e as LockfileEntry).name ===
                "string" &&
              typeof (e as LockfileEntry)
                .version === "string",
          )
          .map((e: LockfileEntry) => ({
            name: e.name,
            version: e.version,
          }))
      : [];

    if (entries.length === 0) {
      return errorResponse(
        "entries array is required with at least one { name, version } object",
        400,
      );
    }

    const result = await resolveLockfileEntries(
      compromisedVersion,
      entries,
    );

    return json(result);
  } catch (error) {
    console.error(
      "Lockfile resolution failed:",
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
      "Failed to resolve lockfile entries",
      500,
    );
  }
}
