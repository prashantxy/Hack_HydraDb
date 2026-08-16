import {
  healthRoute,
} from "./routes/health";

import {
  packageRoute,
} from "./routes/packages";

import {
  versionDependenciesRoute,
} from "./routes/versions";

import {
  graphRoute,
} from "./routes/graph";

import {
  errorResponse,
} from "./response";

export async function router(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);

  // ----------------------------------------
  // CORS preflight
  // ----------------------------------------

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization",
      },
    });
  }

  // ----------------------------------------
  // Only GET routes for now
  // ----------------------------------------

  if (req.method !== "GET") {
    return errorResponse(
      "Method not allowed",
      405,
    );
  }

  // ----------------------------------------
  // GET /health
  // ----------------------------------------

  if (url.pathname === "/health") {
    return healthRoute();
  }

  // ----------------------------------------
  // GET /packages/:packageName/graph
  // IMPORTANT:
  // This must come BEFORE /packages/:packageName
  // ----------------------------------------

  // GET /packages/:packageName/graph
const packagesPrefix = "/packages/";
const graphSuffix = "/graph";

if (
  url.pathname.startsWith(packagesPrefix) &&
  url.pathname.endsWith(graphSuffix)
) {
  const packageName = decodeURIComponent(
    url.pathname.slice(
      packagesPrefix.length,
      -graphSuffix.length,
    ),
  );

  const depth =
    url.searchParams.get("depth") ??
    undefined;

  return graphRoute(
    packageName,
    depth,
  );
}

  // ----------------------------------------
  // GET /packages/:packageName
  // ----------------------------------------

  if (
    url.pathname.startsWith(packagesPrefix)
  ) {
    const packageName = decodeURIComponent(
      url.pathname.slice(
        packagesPrefix.length,
      ),
    );

    return packageRoute(packageName);
  }

  // ----------------------------------------
  // GET /versions/:versionKey/dependencies
  // ----------------------------------------

  const versionsPrefix = "/versions/";
  const dependenciesSuffix = "/dependencies";

  if (
    url.pathname.startsWith(versionsPrefix) &&
    url.pathname.endsWith(
      dependenciesSuffix,
    )
  ) {
    const versionKey = decodeURIComponent(
      url.pathname.slice(
        versionsPrefix.length,
        -dependenciesSuffix.length,
      ),
    );

    return versionDependenciesRoute(
      versionKey,
    );
  }

  // ----------------------------------------
  // 404
  // ----------------------------------------

  return errorResponse(
    "Route not found",
    404,
  );
}