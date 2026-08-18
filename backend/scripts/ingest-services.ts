import {
  upsertServices,
  createServiceDependencyEdges,
  type ServiceVertex,
  type ServiceDependencyEdge,
} from "../src/graph/query/services";

function stableNumericId(key: string): number {
  let hash = 2166136261;

  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) + 1;
}

function versionId(
  packageName: string,
  version: string,
): number {
  return stableNumericId(
    `version:npm:${packageName}@${version}`,
  );
}

const services: ServiceVertex[] = [
  {
    id: stableNumericId("service:payment-api"),
    name: "payment-api",
    repo: "company/payment-api",
    team: "payments",
    environment: "production",
  },
  {
    id: stableNumericId("service:checkout-service"),
    name: "checkout-service",
    repo: "company/checkout-service",
    team: "commerce",
    environment: "production",
  },
  {
    id: stableNumericId("service:analytics-api"),
    name: "analytics-api",
    repo: "company/analytics-api",
    team: "data",
    environment: "production",
  },
];

const edges: ServiceDependencyEdge[] = [
  {
    id: stableNumericId(
      "service:payment-api->npm:axios@1.7.2",
    ),
    serviceId: stableNumericId("service:payment-api"),
    versionId: versionId("axios", "1.7.2"),
  },

  {
    id: stableNumericId(
      "service:checkout-service->npm:form-data@4.0.6",
    ),
    serviceId: stableNumericId(
      "service:checkout-service",
    ),
    versionId: versionId("form-data", "4.0.6"),
  },

  {
    id: stableNumericId(
      "service:analytics-api->npm:mime-types@2.1.35",
    ),
    serviceId: stableNumericId(
      "service:analytics-api",
    ),
    versionId: versionId(
      "mime-types",
      "2.1.35",
    ),
  },
];

console.log("Writing services...");

await upsertServices(services);

console.log("Writing service dependencies...");

await createServiceDependencyEdges(edges);

console.log("Service ingestion complete.");