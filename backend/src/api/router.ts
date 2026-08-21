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
} from "./routes/attack-path";import { registerServiceRoute,
  servicesRoute,
} from "./routes/service";

import {
  coMaintainersRoute,
} from "./routes/co-maintainers";

import {
  lockfileResolveRoute,
} from "./routes/lockfile-resolve";

import {
  typosquatRoute,
} from "./routes/typosquat";

import {
  pypiIngestRoute,
} from "./routes/pypi-ingest";

import {
  errorResponse,
} from "./response";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(res: Response): Response {
  const newHeaders = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    if (!newHeaders.has(k)) newHeaders.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

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
      headers: CORS_HEADERS,
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
    return withCors(await registerServiceRoute(req));
  }

  // ==========================================================
  // POST /lockfiles/resolve
  // Check which lockfile entries resolved to a
  // compromised version
  // ==========================================================

  if (
    url.pathname === "/lockfiles/resolve" &&
    req.method === "POST"
  ) {
    return withCors(await lockfileResolveRoute(req));
  }

  // ==========================================================
  // ONLY GET ROUTES AFTER THIS POINT
  // ==========================================================

  if (req.method !== "GET") {
    return withCors(errorResponse("Method not allowed", 405));
  }

  // ==========================================================
  // GET /health
  // ==========================================================

  if (url.pathname === "/health") {
    return withCors(healthRoute());
  }

  // ==========================================================
  // GET /services
  // ==========================================================

  if (url.pathname === "/services") {
    return withCors(await servicesRoute());
  }

  // ==========================================================
  // PyPI PACKAGE ROUTES
  // ==========================================================

  const pypiPrefix = "/pypi/";

  if (
    url.pathname.startsWith(
      pypiPrefix,
    )
  ) {
    const pypiPath =
      url.pathname.slice(
        pypiPrefix.length,
      );

    // ========================================================
    // GET /pypi/:packageName/:version/ingest
    // ========================================================

    const ingestSuffix = "/ingest";

    if (
      pypiPath.endsWith(
        ingestSuffix,
      )
    ) {
      const pvPath =
        pypiPath.slice(
          0,
          -ingestSuffix.length,
        );

      const sepIdx =
        pvPath.lastIndexOf("/");

      if (sepIdx === -1) {
        return withCors(errorResponse(
          "Expected /pypi/:packageName/:version/ingest",
          400,
        ));
      }

      const pypiPkgName =
        decodeURIComponent(
          pvPath.slice(
            0,
            sepIdx,
          ),
        );

      const pypiVersion =
        decodeURIComponent(
          pvPath.slice(
            sepIdx + 1,
          ),
        );

      if (!pypiPkgName) {
        return withCors(errorResponse("Package name is required", 400));
      }

      if (!pypiVersion) {
        return withCors(errorResponse("Version is required", 400));
      }

      const pypiDepth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return withCors(await pypiIngestRoute(
        pypiPkgName,
        pypiVersion,
        pypiDepth,
      ));
    }
  }

  // ==========================================================
  // BACK TO npm PACKAGE ROUTES
  // ==========================================================

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
        return withCors(errorResponse("Package name is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return withCors(await graphRoute(
        packageName,
        depth,
      ));
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
        return withCors(errorResponse(
          "Expected /packages/:packageName/:version/ingest",
          400,
        ));
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
        return withCors(errorResponse("Package name is required", 400));
      }

      if (!version) {
        return withCors(errorResponse("Version is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return withCors(await ingestPackageRoute(
        packageName,
        version,
        depth,
      ));
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
        return withCors(errorResponse(
          "Expected /packages/:packageName/:version/analysis",
          400,
        ));
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
        return withCors(errorResponse("Package name is required", 400));
      }

      if (!version) {
        return withCors(errorResponse("Version is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      const versionKey =
        `npm:${packageName}@${version}`;

      return withCors(await analysisRoute(
        versionKey,
        depth,
      ));
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
        return withCors(errorResponse(
          "Expected /packages/:packageName/:version/risk",
          400,
        ));
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
        return withCors(errorResponse("Package name is required", 400));
      }

      if (!version) {
        return withCors(errorResponse("Version is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      const versionKey =
        `npm:${packageName}@${version}`;

      return withCors(await riskRoute(
        versionKey,
        depth,
      ));
    }

    // ========================================================
    // GET /packages/:packageName
    // ========================================================

    const packageName =
      decodeURIComponent(
        packagePath,
      );

    if (!packageName) {
      return withCors(errorResponse("Package name is required", 400));
    }

    return withCors(await packageRoute(
        packageName,
      ));
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
        return withCors(errorResponse("Version key is required", 400));
      }

      return withCors(await versionDependenciesRoute(
        versionKey,
      ));
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
        return withCors(errorResponse("Version key is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return withCors(await blastRadiusRoute(
        versionKey,
        depth,
      ));
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
        return withCors(errorResponse("Version key is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return withCors(await riskRoute(
        versionKey,
        depth,
      ));
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
        return withCors(errorResponse("Version key is required", 400));
      }

      const depth =
        url.searchParams.get(
          "depth",
        ) ?? undefined;

      return withCors(await attackPathRoute(
        versionKey,
        depth,
      ));
    }

    // ========================================================
    // GET /versions/:versionKey/co-maintainers
    // ========================================================

    const coMaintainersSuffix =
      "/co-maintainers";

    if (
      versionPath.endsWith(
        coMaintainersSuffix,
      )
    ) {
      const versionKey =
        decodeURIComponent(
          versionPath.slice(
            0,
            -coMaintainersSuffix.length,
          ),
        );

      if (!versionKey) {
        return withCors(errorResponse("Version key is required", 400));
      }

      return withCors(await coMaintainersRoute(
        versionKey,
      ));
    }

    return withCors(errorResponse("Route not found", 404));
  }

  // ==========================================================
  // TYPOSQUAT ROUTES
  // ==========================================================

  const typosquatPrefix =
    "/typosquat/";

  if (
    url.pathname.startsWith(
      typosquatPrefix,
    )
  ) {
    const packageName =
      decodeURIComponent(
        url.pathname.slice(
          typosquatPrefix.length,
        ),
      );

    if (!packageName) {
      return withCors(errorResponse("Package name is required", 400));
    }

    const threshold =
      url.searchParams.get(
        "threshold",
      ) ?? undefined;

    return withCors(await typosquatRoute(
      packageName,
      threshold,
    ));
  }

  // ==========================================================
  // GLOBAL 404
  // ==========================================================

  return withCors(errorResponse("Route not found", 404));
}