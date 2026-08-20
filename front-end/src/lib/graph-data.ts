export type NodeType = "package" | "service" | "environment";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface GraphNodeData {
  id: string;
  type: NodeType;
  label: string;
  severity?: Severity;
  environment?: string;
  /** Scroll progress when this node starts appearing */
  appearAt: number;
  /** Position in 3D space at full visibility */
  restPosition: [number, number, number];
  /** Node visual radius */
  radius: number;
  /** Whether this node is on the critical blast-radius path */
  onCriticalPath: boolean;
}

export interface GraphEdgeData {
  source: string;
  target: string;
  /** Whether this edge is on the critical blast-radius path */
  onCriticalPath: boolean;
  /** Scroll progress when this edge becomes visible */
  appearAt: number;
}

// ── Demo graph data ──────────────────────────────────────────────

export const graphNodes: GraphNodeData[] = [
  // Root package
  {
    id: "axios",
    type: "package",
    label: "axios@1.7.2",
    severity: "CRITICAL",
    appearAt: 0.0,
    restPosition: [0, 3, 0],
    radius: 0.35,
    onCriticalPath: true,
  },
  // Dependencies
  {
    id: "form-data",
    type: "package",
    label: "form-data@4.0.6",
    severity: "MEDIUM",
    appearAt: 0.10,
    restPosition: [3, 1.5, 1],
    radius: 0.25,
    onCriticalPath: true,
  },
  {
    id: "follow-redirects",
    type: "package",
    label: "follow-redirects@1.16.0",
    severity: "HIGH",
    appearAt: 0.10,
    restPosition: [-3, 1.5, -1],
    radius: 0.25,
    onCriticalPath: true,
  },
  {
    id: "mime-types",
    type: "package",
    label: "mime-types@2.1.35",
    severity: "LOW",
    appearAt: 0.28,
    restPosition: [5, 3.5, 1.5],
    radius: 0.2,
    onCriticalPath: false,
  },
  {
    id: "qs",
    type: "package",
    label: "qs@6.13.0",
    appearAt: 0.28,
    restPosition: [-5, 3, -1.5],
    radius: 0.2,
    onCriticalPath: false,
  },
  {
    id: "proxy-from-env",
    type: "package",
    label: "proxy-from-env@1.1.0",
    appearAt: 0.28,
    restPosition: [0, 5, 0.5],
    radius: 0.2,
    onCriticalPath: false,
  },
  // Services
  {
    id: "checkout-service",
    type: "service",
    label: "checkout-service",
    appearAt: 0.42,
    restPosition: [3, -1.5, 0.5],
    radius: 0.4,
    onCriticalPath: true,
  },
  {
    id: "payment-api",
    type: "service",
    label: "payment-api",
    appearAt: 0.42,
    restPosition: [-3, -1.5, -0.5],
    radius: 0.4,
    onCriticalPath: true,
  },
  {
    id: "analytics-api",
    type: "service",
    label: "analytics-api",
    appearAt: 0.42,
    restPosition: [0, -3, 0],
    radius: 0.35,
    onCriticalPath: false,
  },
  // Production
  {
    id: "production",
    type: "environment",
    label: "production",
    appearAt: 0.62,
    restPosition: [0, -5.5, 0],
    radius: 0.5,
    onCriticalPath: true,
  },
];

export const graphEdges: GraphEdgeData[] = [
  // axios → dependencies
  { source: "axios", target: "form-data", onCriticalPath: true, appearAt: 0.10 },
  { source: "axios", target: "follow-redirects", onCriticalPath: true, appearAt: 0.10 },
  { source: "axios", target: "proxy-from-env", onCriticalPath: false, appearAt: 0.28 },
  // form-data → mime-types
  { source: "form-data", target: "mime-types", onCriticalPath: false, appearAt: 0.28 },
  // follow-redirects → qs
  { source: "follow-redirects", target: "qs", onCriticalPath: false, appearAt: 0.28 },
  // dependencies → services
  { source: "form-data", target: "checkout-service", onCriticalPath: true, appearAt: 0.42 },
  { source: "follow-redirects", target: "payment-api", onCriticalPath: true, appearAt: 0.42 },
  { source: "mime-types", target: "analytics-api", onCriticalPath: false, appearAt: 0.42 },
  // services → production
  { source: "checkout-service", target: "production", onCriticalPath: true, appearAt: 0.62 },
  { source: "payment-api", target: "production", onCriticalPath: true, appearAt: 0.62 },
  { source: "analytics-api", target: "production", onCriticalPath: false, appearAt: 0.62 },
];

// ── Camera keyframes ─────────────────────────────────────────────

export interface CameraKeyframe {
  scroll: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

export const cameraKeyframes: CameraKeyframe[] = [
  { scroll: 0.0, position: [0, 0.5, 12], lookAt: [0, 1, 0] },
  { scroll: 0.15, position: [0, 0, 16], lookAt: [0, 1, 0] },
  { scroll: 0.35, position: [0, 0.5, 22], lookAt: [0, 0, 0] },
  { scroll: 0.55, position: [1, 1, 28], lookAt: [0, -1, 0] },
  { scroll: 0.75, position: [0, 1.5, 34], lookAt: [0, -1, 0] },
  { scroll: 1.0, position: [0, 2, 40], lookAt: [0, -1, 0] },
];

// ── Scroll stages ────────────────────────────────────────────────

export interface ScrollStage {
  start: number;
  end: number;
  lines: string[];
  variant: "hero" | "statement" | "stats";
}

export const scrollStages: ScrollStage[] = [
  {
    start: 0.0,
    end: 0.06,
    lines: ["CHAINTRACE"],
    variant: "hero",
  },
  {
    start: 0.04,
    end: 0.14,
    lines: ["Know the blast radius", "before the attack does."],
    variant: "statement",
  },
  {
    start: 0.16,
    end: 0.30,
    lines: ["It starts", "with one package."],
    variant: "statement",
  },
  {
    start: 0.32,
    end: 0.44,
    lines: ["But packages", "don't exist alone."],
    variant: "statement",
  },
  {
    start: 0.46,
    end: 0.58,
    lines: ["Dependencies", "become infrastructure."],
    variant: "statement",
  },
  {
    start: 0.60,
    end: 0.72,
    lines: ["Infrastructure", "becomes production."],
    variant: "statement",
  },
  {
    start: 0.76,
    end: 0.88,
    lines: ["This is", "the blast radius."],
    variant: "statement",
  },
  {
    start: 0.82,
    end: 0.95,
    lines: [
      "CRITICAL",
      "90 / 100",
      "",
      "3 affected services",
      "3 production services",
    ],
    variant: "stats",
  },
];
