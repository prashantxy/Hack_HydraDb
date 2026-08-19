import {
  healthRoute,
} from "./routes/health";

import {
  packageRoute,
} from "./routes/packages";

import {
  ingestPackageRoute,
} from "./routes/ingest";

import {
  analysisRoute,
} from "./routes/analysis";

import {
  versionDependenciesRoute,
} from "./routes/versions";

import {
  graphRoute,
} from "./routes/graph";

import {
  blastRadiusRoute,
} from "./routes/blast-radius";

import {
  riskRoute,
} from "./routes/risk";

import {
  attackPathRoute,
} from "./routes/attack-path";

import {
  registerServiceRoute,
  servicesRoute,
} from "./routes/service";

import {
  errorResponse,
} from "./response";

export async function router(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);

  // ==========================================================
  // CORS PREFLIGHT
  // ==========================================================

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization",
      },
    });
  }

  // ==========================================================
  // POST /services
  // Register a service and its dependencies
  // ==========================================================

  if (
    url.pathname === "/services" &&
    req.method === "POST"
  ) {
    return registerServiceRoute(req);
  }

  // ==========================================================
  // ONLY GET ROUTES AFTER THIS POINT
  // ==========================================================

  if (req.method !== "GET") {
    return errorResponse(
      "Method not allowed",
      405,
    );
  }

  // ==========================================================
  // GET /health
  // ==========================================================

  if (url.pathname === "/health") {
    return healthRoute();
  }

  // ==========================================================
  // GET /services
  // ==========================================================

  if (url.pathname === "/services") {
    return servicesRoute();
  }

  // ==========================================================
  // PACKAGE ROUTES
  // ==========================================================

  const packagesPrefix = "/packages/";

  if (
    url.pathname.startsWith(
      packagesPrefix,
    )
  ) {
    const packagePath =
      url.pathname.slice(
        packagesPrefix.length,
      );

    // ========================================================
    // GET /packages/:packageName/graph
    // ========================================================

    const graphSuffix = "/graph";

    if (
      packagePath.endsWith(
        graphSuffix,
      )
    ) {
      const packageName =
        decodeURIComponent(
          packagePath.slice(
            0,
            -graphSuffix.length,
          ),
        );

      if (!packageName) {
        return errorResponse(
          "Package name is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return graphRoute(
        packageName,
        depth,
      );
    }

    // ========================================================
    // GET /packages/:packageName/:version/ingest
    // ========================================================

    const ingestSuffix =
      "/ingest";

    if (
      packagePath.endsWith(
        ingestSuffix,
      )
    ) {
      const packageVersionPath =
        packagePath.slice(
          0,
          -ingestSuffix.length,
        );

      const separatorIndex =
        packageVersionPath.lastIndexOf(
          "/",
        );

      if (separatorIndex === -1) {
        return errorResponse(
          "Expected /packages/:packageName/:version/ingest",
          400,
        );
      }

      const packageName =
        decodeURIComponent(
          packageVersionPath.slice(
            0,
            separatorIndex,
          ),
        );

      const version =
        decodeURIComponent(
          packageVersionPath.slice(
            separatorIndex + 1,
          ),
        );

      if (!packageName) {
        return errorResponse(
          "Package name is required",
          400,
        );
      }

      if (!version) {
        return errorResponse(
          "Version is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return ingestPackageRoute(
        packageName,
        version,
        depth,
      );
    }

    // ========================================================
    // GET /packages/:packageName/:version/analysis
    // ========================================================

    const analysisSuffix =
      "/analysis";

    if (
      packagePath.endsWith(
        analysisSuffix,
      )
    ) {
      const packageVersionPath =
        packagePath.slice(
          0,
          -analysisSuffix.length,
        );

      const separatorIndex =
        packageVersionPath.lastIndexOf(
          "/",
        );

      if (separatorIndex === -1) {
        return errorResponse(
          "Expected /packages/:packageName/:version/analysis",
          400,
        );
      }

      const packageName =
        decodeURIComponent(
          packageVersionPath.slice(
            0,
            separatorIndex,
          ),
        );

      const version =
        decodeURIComponent(
          packageVersionPath.slice(
            separatorIndex + 1,
          ),
        );

      if (!packageName) {
        return errorResponse(
          "Package name is required",
          400,
        );
      }

      if (!version) {
        return errorResponse(
          "Version is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      const versionKey =
        `npm:${packageName}@${version}`;

      return analysisRoute(
        versionKey,
        depth,
      );
    }

    // ========================================================
    // GET /packages/:packageName/:version/risk
    // ========================================================

    const riskSuffix =
      "/risk";

    if (
      packagePath.endsWith(
        riskSuffix,
      )
    ) {
      const packageVersionPath =
        packagePath.slice(
          0,
          -riskSuffix.length,
        );

      const separatorIndex =
        packageVersionPath.lastIndexOf(
          "/",
        );

      if (separatorIndex === -1) {
        return errorResponse(
          "Expected /packages/:packageName/:version/risk",
          400,
        );
      }

      const packageName =
        decodeURIComponent(
          packageVersionPath.slice(
            0,
            separatorIndex,
          ),
        );

      const version =
        decodeURIComponent(
          packageVersionPath.slice(
            separatorIndex + 1,
          ),
        );

      if (!packageName) {
        return errorResponse(
          "Package name is required",
          400,
        );
      }

      if (!version) {
        return errorResponse(
          "Version is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      const versionKey =
        `npm:${packageName}@${version}`;

      return riskRoute(
        versionKey,
        depth,
      );
    }

    // ========================================================
    // GET /packages/:packageName
    // ========================================================

    const packageName =
      decodeURIComponent(
        packagePath,
      );

    if (!packageName) {
      return errorResponse(
        "Package name is required",
        400,
      );
    }

    return packageRoute(
      packageName,
    );
  }

  // ==========================================================
  // VERSION ROUTES
  // ==========================================================

  const versionsPrefix =
    "/versions/";

  if (
    url.pathname.startsWith(
      versionsPrefix,
    )
  ) {
    const versionPath =
      url.pathname.slice(
        versionsPrefix.length,
      );

    // ========================================================
    // GET /versions/:versionKey/dependencies
    // ========================================================

    const dependenciesSuffix =
      "/dependencies";

    if (
      versionPath.endsWith(
        dependenciesSuffix,
      )
    ) {
      const versionKey =
        decodeURIComponent(
          versionPath.slice(
            0,
            -dependenciesSuffix.length,
          ),
        );

      if (!versionKey) {
        return errorResponse(
          "Version key is required",
          400,
        );
      }

      return versionDependenciesRoute(
        versionKey,
      );
    }

    // ========================================================
    // GET /versions/:versionKey/blast-radius
    // ========================================================

    const blastRadiusSuffix =
      "/blast-radius";

    if (
      versionPath.endsWith(
        blastRadiusSuffix,
      )
    ) {
      const versionKey =
        decodeURIComponent(
          versionPath.slice(
            0,
            -blastRadiusSuffix.length,
          ),
        );

      if (!versionKey) {
        return errorResponse(
          "Version key is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return blastRadiusRoute(
        versionKey,
        depth,
      );
    }

    // ========================================================
    // GET /versions/:versionKey/risk
    // ========================================================

    const riskSuffix =
      "/risk";

    if (
      versionPath.endsWith(
        riskSuffix,
      )
    ) {
      const versionKey =
        decodeURIComponent(
          versionPath.slice(
            0,
            -riskSuffix.length,
          ),
        );

      if (!versionKey) {
        return errorResponse(
          "Version key is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return riskRoute(
        versionKey,
        depth,
      );
    }

    // ========================================================
    // GET /versions/:versionKey/attack-path
    // ========================================================

    const attackPathSuffix =
      "/attack-path";

    if (
      versionPath.endsWith(
        attackPathSuffix,
      )
    ) {
      const versionKey =
        decodeURIComponent(
          versionPath.slice(
            0,
            -attackPathSuffix.length,
          ),
        );

      if (!versionKey) {
        return errorResponse(
          "Version key is required",
          400,
        );
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return attackPathRoute(
        versionKey,
        depth,
      );
    }

    return errorResponse(
      "Route not found",
      404,
    );
  }

  // ==========================================================
  // GLOBAL 404
  // ==========================================================

  return errorResponse(
    "Route not found",
    404,
  );
}