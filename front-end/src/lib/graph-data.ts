export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type GraphNodeType = "package" | "service";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  severity?: Severity;
  environment?: string;
  x: number;
  y: number;
  z: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  hops?: number;
}

export interface ServiceRisk {
  serviceId: number;
  name: string;
  environment: string | null;
  hops: number;
  score: number;
  severity: Severity;
  reasons: string[];
}

export interface PackageRisk {
  version: string;
  score: number;
  severity: Severity;
  affectedServices: number;
  productionServices: number;
  services: ServiceRisk[];
}

export interface AttackPath {
  serviceId: number;
  serviceName: string;
  environment: string | null;
  hops: number;
  path: string[];
}

// ─── Mock Graph Data ───────────────────────────────────────────

export const mockGraphNodes: GraphNode[] = [
  {
    id: "npm:axios@1.7.2",
    type: "package",
    label: "axios@1.7.2",
    severity: "CRITICAL",
    x: 0,
    y: 2.5,
    z: 0,
  },
  {
    id: "npm:form-data@4.0.6",
    type: "package",
    label: "form-data@4.0.6",
    severity: "CRITICAL",
    x: -2.5,
    y: 1,
    z: 0.5,
  },
  {
    id: "npm:follow-redirects@1.15.6",
    type: "package",
    label: "follow-redirects@1.15.6",
    severity: "HIGH",
    x: 2.5,
    y: 1,
    z: -0.5,
  },
  {
    id: "npm:mime-types@2.1.35",
    type: "package",
    label: "mime-types@2.1.35",
    severity: "HIGH",
    x: -1.2,
    y: -0.5,
    z: 1,
  },
  {
    id: "npm:proxy-from-env@1.1.0",
    type: "package",
    label: "proxy-from-env@1.1.0",
    severity: "LOW",
    x: 1.2,
    y: -0.5,
    z: -1,
  },
  {
    id: "checkout-service",
    type: "service",
    label: "checkout-service",
    environment: "production",
    severity: "CRITICAL",
    x: -3.5,
    y: -2.5,
    z: 0,
  },
  {
    id: "payment-api",
    type: "service",
    label: "payment-api",
    environment: "production",
    severity: "CRITICAL",
    x: 0,
    y: -2.5,
    z: 0,
  },
  {
    id: "analytics-api",
    type: "service",
    label: "analytics-api",
    environment: "production",
    severity: "MEDIUM",
    x: 3.5,
    y: -2.5,
    z: 0,
  },
];

export const mockGraphEdges: GraphEdge[] = [
  { source: "npm:axios@1.7.2", target: "npm:form-data@4.0.6", hops: 0 },
  { source: "npm:axios@1.7.2", target: "npm:follow-redirects@1.15.6", hops: 0 },
  { source: "npm:axios@1.7.2", target: "npm:proxy-from-env@1.1.0", hops: 0 },
  { source: "npm:form-data@4.0.6", target: "npm:mime-types@2.1.35", hops: 1 },
  { source: "npm:follow-redirects@1.15.6", target: "npm:mime-types@2.1.35", hops: 1 },
  { source: "checkout-service", target: "npm:form-data@4.0.6", hops: 0 },
  { source: "payment-api", target: "npm:axios@1.7.2", hops: 0 },
  { source: "analytics-api", target: "npm:mime-types@2.1.35", hops: 0 },
];

// ─── Mock Risk Data ────────────────────────────────────────────

export const mockAxiosRisk: PackageRisk = {
  version: "npm:axios@1.7.2",
  score: 90,
  severity: "CRITICAL",
  affectedServices: 3,
  productionServices: 3,
  services: [
    {
      serviceId: 1,
      name: "payment-api",
      environment: "production",
      hops: 0,
      score: 90,
      severity: "CRITICAL",
      reasons: ["Affected production service", "Direct dependency"],
    },
    {
      serviceId: 2,
      name: "checkout-service",
      environment: "production",
      hops: 1,
      score: 80,
      severity: "CRITICAL",
      reasons: ["Affected production service", "One-hop transitive dependency"],
    },
    {
      serviceId: 3,
      name: "analytics-api",
      environment: "production",
      hops: 2,
      score: 70,
      severity: "HIGH",
      reasons: ["Affected production service", "2-hop transitive dependency"],
    },
  ],
};

export const mockAttackPaths: AttackPath[] = [
  {
    serviceId: 1,
    serviceName: "payment-api",
    environment: "production",
    hops: 0,
    path: ["npm:payment-service@3.2.1", "npm:axios@1.7.2"],
  },
  {
    serviceId: 2,
    serviceName: "checkout-service",
    environment: "production",
    hops: 1,
    path: [
      "npm:checkout-core@2.1.0",
      "npm:form-data@4.0.6",
      "npm:axios@1.7.2",
    ],
  },
  {
    serviceId: 3,
    serviceName: "analytics-api",
    environment: "production",
    hops: 2,
    path: [
      "npm:analytics-sdk@1.0.3",
      "npm:mime-types@2.1.35",
      "npm:form-data@4.0.6",
      "npm:axios@1.7.2",
    ],
  },
];

// ─── API Boundary ──────────────────────────────────────────────
// This function is designed so the mock data can later be replaced
// with real API calls to GET /packages/:package/:version/analysis

export async function fetchPackageAnalysis(
  packageName: string,
  version: string,
): Promise<{
  risk: PackageRisk;
  attackPaths: AttackPath[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}> {
  // TODO: Replace with real API call
  // const res = await fetch(`${API_URL}/packages/${packageName}/${version}/analysis`);
  // return res.json();

  return {
    risk: mockAxiosRisk,
    attackPaths: mockAttackPaths,
    graphNodes: mockGraphNodes,
    graphEdges: mockGraphEdges,
  };
}
