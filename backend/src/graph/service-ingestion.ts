import {
  upsertServices,
  createServiceDependencyEdges,
  type ServiceVertex,
  type ServiceDependencyEdge,
} from "./query/services";

import {
  versionId,
} from "../npm/ingest";

export interface RegisterServiceInput {
  name: string;

  repo?: string;

  team?: string;

  environment?: string;

  dependencies: Array<{
    name: string;
    version: string;
  }>;
}

function serviceId(
  name: string,
): number {
  let hash = 2166136261;

  const key =
    `service:${name}`;

  for (
    let i = 0;
    i < key.length;
    i += 1
  ) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return (
    (hash >>> 0) + 1
  );
}

function serviceDependencyEdgeId(
  service: number,
  version: number,
): number {
  let hash = 2166136261;

  const key =
    `depends-on-version:${service}->${version}`;

  for (
    let i = 0;
    i < key.length;
    i += 1
  ) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return (
    (hash >>> 0) + 1
  );
}

export async function registerService(
  input: RegisterServiceInput,
): Promise<{
  serviceId: number;
  dependencyCount: number;
}> {
  const id =
    serviceId(input.name);

  const service: ServiceVertex = {
    id,

    name: input.name,

    repo:
      input.repo ??
      input.name,

    team:
      input.team,

    environment:
      input.environment ??
      "development",
  };

  await upsertServices([
    service,
  ]);

  const edges: ServiceDependencyEdge[] =
    [];

  for (
    const dependency
    of input.dependencies
  ) {
    const dependencyVersionId =
      versionId(
        dependency.name,
        dependency.version,
      );

    edges.push({
      id:
        serviceDependencyEdgeId(
          id,
          dependencyVersionId,
        ),

      serviceId: id,

      versionId:
        dependencyVersionId,
    });
  }

  if (
    edges.length > 0
  ) {
    await createServiceDependencyEdges(
      edges,
    );
  }

  return {
    serviceId: id,

    dependencyCount:
      edges.length,
  };
}