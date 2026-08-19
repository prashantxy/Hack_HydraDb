
import {
  registerService,
} from "../../graph/service-ingestion";

import {
  getServices,
} from "../../graph/query/services";

import {
  errorResponse,
} from "../response";

export async function registerServiceRoute(
  req: Request,
): Promise<Response> {
  try {
    const body =
      await req.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return errorResponse(
        "Invalid request body",
        400,
      );
    }

    const name =
      typeof body.name === "string"
        ? body.name
        : "";

    if (!name) {
      return errorResponse(
        "Service name is required",
        400,
      );
    }

    const dependencies =
      Array.isArray(
        body.dependencies,
      )
        ? body.dependencies
        : [];

    const normalizedDependencies =
      dependencies
        .filter(
          (
            dependency: unknown,
          ) =>
            typeof dependency ===
              "object" &&
            dependency !== null &&
            typeof (
              dependency as {
                name?: unknown;
              }
            ).name === "string" &&
            typeof (
              dependency as {
                version?: unknown;
              }
            ).version === "string",
        )
        .map(
          (
            dependency: {
              name: string;
              version: string;
            },
          ) => ({
            name:
              dependency.name,

            version:
              dependency.version,
          }),
        );

    const result =
      await registerService({
        name,

        repo:
          typeof body.repo ===
          "string"
            ? body.repo
            : undefined,

        team:
          typeof body.team ===
          "string"
            ? body.team
            : undefined,

        environment:
          typeof body.environment ===
          "string"
            ? body.environment
            : "development",

        dependencies:
          normalizedDependencies,
      });

    return new Response(
      JSON.stringify({
        success: true,

        serviceId:
          result.serviceId,

        dependencyCount:
          result.dependencyCount,
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
      "Service registration failed:",
      error,
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Service registration failed",
      500,
    );
  }
}

export async function servicesRoute(): Promise<Response> {
  try {
    const services = await getServices();

    return new Response(
      JSON.stringify({
        success: true,
        count: services.length,
        services,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error(
      "Failed to fetch services:",
      error,
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Failed to fetch services",
      500,
    );
  }
}