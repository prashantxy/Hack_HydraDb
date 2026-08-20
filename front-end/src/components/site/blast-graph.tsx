"use client";

import { Ticks, useInView } from "./primitives";

/*
 * The signature: a blast radius, drawn the way the API returns it.
 *
 * A compromised Version sits at hop 0. Edges are DEPENDS_ON, walked
 * in reverse, so the pulse travels the way an exploit would — out
 * from the bad version, through the packages that pull it in, into
 * the services that ship them. Severity on the right is the score
 * from /risk: production weighs heaviest, then hop distance.
 *
 * The diagram is framed like a readout, with the query in the head
 * bar and the totals in the foot, so the plot area carries only the
 * graph and stays vertically balanced inside it.
 */

type Node = {
  id: string;
  x: number;
  y: number;
  label: string;
  hop: number;
  sev?: "CRITICAL" | "HIGH" | "MEDIUM";
  env?: string;
};

/* plot area: x 70…606, y 52…300 — content is centred on y = 176 */
const HOP_X = [70, 234, 404, 606];

const NODES: Node[] = [
  { id: "axios", x: HOP_X[0], y: 176, label: "axios@1.7.2", hop: 0 },

  { id: "sdk", x: HOP_X[1], y: 78, label: "acme-sdk@4.2.0", hop: 1 },
  { id: "http", x: HOP_X[1], y: 176, label: "http-client@2.1.4", hop: 1 },
  { id: "tele", x: HOP_X[1], y: 274, label: "telemetry@0.9.1", hop: 1 },

  { id: "auth", x: HOP_X[2], y: 52, label: "auth-kit@3.0.1", hop: 2 },
  { id: "pay", x: HOP_X[2], y: 134, label: "pay-core@7.4.0", hop: 2 },
  { id: "web", x: HOP_X[2], y: 218, label: "web-utils@1.2.9", hop: 2 },
  { id: "logs", x: HOP_X[2], y: 300, label: "log-ship@5.5.2", hop: 2 },

  {
    id: "checkout",
    x: HOP_X[3],
    y: 84,
    label: "checkout-api",
    hop: 3,
    sev: "CRITICAL",
    env: "production",
  },
  {
    id: "billing",
    x: HOP_X[3],
    y: 176,
    label: "billing-worker",
    hop: 3,
    sev: "CRITICAL",
    env: "production",
  },
  {
    id: "docs",
    x: HOP_X[3],
    y: 268,
    label: "docs-site",
    hop: 3,
    sev: "MEDIUM",
    env: "staging",
  },
];

const EDGES: [string, string][] = [
  ["axios", "sdk"],
  ["axios", "http"],
  ["axios", "tele"],

  ["sdk", "auth"],
  ["sdk", "pay"],
  ["http", "pay"],
  ["http", "web"],
  ["tele", "logs"],
  ["tele", "web"],

  ["auth", "checkout"],
  ["pay", "checkout"],
  ["pay", "billing"],
  ["web", "billing"],
  ["logs", "docs"],
];

const byId = new Map(NODES.map((n) => [n.id, n]));

/* horizontal cubic — control points on the midline keep the bundle
 * readable where several edges converge on one service */
function edgePath(a: Node, b: Node) {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x + 14} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 14} ${b.y}`;
}

const PLOT_TOP = 40;
const PLOT_BOTTOM = 314;

export function BlastGraph() {
  const { ref, seen } = useInView<HTMLDivElement>(0.2);

  return (
    <div className="ct-frame ct-graph">
      <Ticks />

      <div className="ct-card-head">
        <span>
          Blast radius — <span className="ct-graph-key">npm:axios@1.7.2</span>
        </span>
        <span style={{ color: "var(--fg-4)" }}>depth 3 / 5</span>
      </div>

      <div ref={ref} className={`ctbg ${seen ? "is-in" : ""}`}>
        <svg
          viewBox="0 0 700 330"
          role="img"
          aria-label="Blast radius: one compromised package version reaching three services across three hops"
        >
          <title>Blast radius of axios@1.7.2</title>
          <desc>
            Reverse DEPENDS_ON traversal from a compromised version to the
            services that ship it, with severity scored per service.
          </desc>

          <defs>
            <radialGradient id="ctbg-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--sig)" stopOpacity="0.42" />
              <stop offset="100%" stopColor="var(--sig)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <style>{`
            .ctbg-hop { font: 11px var(--font-jetbrains-mono), monospace; fill: var(--fg-4); letter-spacing: .18em; }
            .ctbg-lbl { font: 12.5px var(--font-jetbrains-mono), monospace; fill: var(--fg-3); }
            .ctbg-lbl-hot { fill: var(--fg); }
            .ctbg-env { font: 11px var(--font-jetbrains-mono), monospace; fill: var(--fg-4); }
            .ctbg-sev { font: 11px var(--font-jetbrains-mono), monospace; letter-spacing: .12em; }
            .ctbg-guide { stroke: rgba(255,255,255,.05); stroke-width: 1; }

            .ctbg-edge {
              fill: none;
              stroke: rgba(255,255,255,.15);
              stroke-width: 1;
              stroke-dasharray: var(--len);
              stroke-dashoffset: var(--len);
            }
            .ctbg.is-in .ctbg-edge {
              animation: ctbg-draw .8s cubic-bezier(.2,.7,.2,1) forwards;
              animation-delay: calc(var(--hop) * 400ms);
            }
            @keyframes ctbg-draw { to { stroke-dashoffset: 0; } }

            /* the blast: a short bright dash running the same path */
            .ctbg-pulse {
              fill: none;
              stroke: var(--sig);
              stroke-width: 1.6;
              stroke-linecap: round;
              stroke-dasharray: 9 999;
              opacity: 0;
            }
            .ctbg.is-in .ctbg-pulse {
              animation: ctbg-run 3.6s linear infinite;
              animation-delay: calc(var(--hop) * 400ms + var(--jit) * 1ms);
            }
            @keyframes ctbg-run {
              0%   { stroke-dashoffset: 0; opacity: 0; }
              5%   { opacity: 1; }
              44%  { stroke-dashoffset: calc(-1 * var(--len)); opacity: 1; }
              52%  { stroke-dashoffset: calc(-1 * var(--len)); opacity: 0; }
              100% { stroke-dashoffset: calc(-1 * var(--len)); opacity: 0; }
            }

            .ctbg-node { transform-box: fill-box; transform-origin: center; transform: scale(0); }
            .ctbg.is-in .ctbg-node {
              animation: ctbg-pop .5s cubic-bezier(.34,1.4,.64,1) forwards;
              animation-delay: calc(var(--hop) * 400ms);
            }
            @keyframes ctbg-pop { to { transform: scale(1); } }

            .ctbg-text { opacity: 0; }
            .ctbg.is-in .ctbg-text {
              animation: ctbg-fade .6s ease forwards;
              animation-delay: calc(var(--hop) * 400ms + 160ms);
            }
            @keyframes ctbg-fade { to { opacity: 1; } }

            .ctbg-ring { transform-box: fill-box; transform-origin: center; opacity: 0; }
            .ctbg.is-in .ctbg-ring {
              animation: ctbg-ring 2.8s cubic-bezier(.2,.7,.2,1) infinite;
            }
            @keyframes ctbg-ring {
              0%   { transform: scale(.55); opacity: .65; }
              70%  { transform: scale(2.2); opacity: 0; }
              100% { transform: scale(2.2); opacity: 0; }
            }

            @media (prefers-reduced-motion: reduce) {
              .ctbg-edge { stroke-dashoffset: 0 !important; }
              .ctbg-node { transform: scale(1) !important; }
              .ctbg-text { opacity: 1 !important; }
              .ctbg-pulse, .ctbg-ring { display: none; }
            }
          `}</style>

          {/* hop columns — depth is the unit the API traverses in */}
          {HOP_X.map((x, i) => (
            <g key={i}>
              <line
                className="ctbg-guide"
                x1={x}
                y1={PLOT_TOP}
                x2={x}
                y2={PLOT_BOTTOM}
              />
              <text
                className="ctbg-hop"
                x={i === 3 ? x + 8 : x}
                y={22}
                textAnchor={i === 3 ? "end" : "middle"}
              >
                {i === 3 ? "SERVICES" : `HOP ${i}`}
              </text>
            </g>
          ))}

          <line
            className="ctbg-guide"
            x1="24"
            y1="30"
            x2="676"
            y2="30"
            stroke="rgba(255,255,255,.09)"
          />

          {/* edges */}
          {EDGES.map(([from, to], i) => {
            const a = byId.get(from)!;
            const b = byId.get(to)!;
            const d = edgePath(a, b);
            // the chord plus a curve allowance is close enough for dash math
            const len = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1.12 + 22);
            const vars = {
              ["--len" as string]: `${len}`,
              ["--hop" as string]: `${a.hop}`,
              ["--jit" as string]: `${(i % 5) * 80}`,
            } as React.CSSProperties;

            return (
              <g key={`${from}-${to}`}>
                <path className="ctbg-edge" d={d} style={vars} />
                <path className="ctbg-pulse" d={d} style={vars} />
              </g>
            );
          })}

          {/* nodes */}
          {NODES.map((n) => {
            const vars = {
              ["--hop" as string]: `${n.hop}`,
            } as React.CSSProperties;
            const isRoot = n.hop === 0;
            const isService = n.hop === 3;
            const sevColor =
              n.sev === "CRITICAL"
                ? "var(--crit)"
                : n.sev === "HIGH"
                  ? "var(--high)"
                  : "var(--med)";

            return (
              <g key={n.id}>
                {isRoot && (
                  <>
                    <circle cx={n.x} cy={n.y} r="46" fill="url(#ctbg-core)" />
                    <circle
                      className="ctbg-ring"
                      cx={n.x}
                      cy={n.y}
                      r="15"
                      fill="none"
                      stroke="var(--sig)"
                      strokeWidth="1"
                    />
                  </>
                )}

                {isService ? (
                  <rect
                    className="ctbg-node"
                    x={n.x - 6}
                    y={n.y - 6}
                    width="12"
                    height="12"
                    fill={sevColor}
                    style={vars}
                  />
                ) : (
                  <circle
                    className="ctbg-node"
                    cx={n.x}
                    cy={n.y}
                    r={isRoot ? 7.5 : 4.5}
                    fill={isRoot ? "var(--sig)" : "var(--ink)"}
                    stroke={isRoot ? "none" : "rgba(255,255,255,.45)"}
                    strokeWidth="1.5"
                    style={vars}
                  />
                )}

                <text
                  className={`ctbg-text ctbg-lbl ${
                    isRoot || isService ? "ctbg-lbl-hot" : ""
                  }`}
                  x={isService ? n.x - 16 : n.x}
                  y={isService ? n.y - 3 : n.y - 15}
                  textAnchor={isService ? "end" : "middle"}
                  style={vars}
                >
                  {n.label}
                </text>

                {isService && (
                  <>
                    <text
                      className="ctbg-text ctbg-env"
                      x={n.x - 16}
                      y={n.y + 13}
                      textAnchor="end"
                      style={vars}
                    >
                      {n.env}
                    </text>
                    <text
                      className="ctbg-text ctbg-sev"
                      x={n.x + 14}
                      y={n.y + 4}
                      fill={sevColor}
                      style={vars}
                    >
                      {n.sev}
                    </text>
                  </>
                )}

                {isRoot && (
                  <text
                    className="ctbg-text ctbg-env"
                    x={n.x}
                    y={n.y + 26}
                    textAnchor="middle"
                    style={vars}
                  >
                    compromised
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ct-graph-foot">
        <span>
          <i className="ct-dot ct-pulse" aria-hidden />
          14 DEPENDS_ON edges walked
        </span>
        <span>3 services reached</span>
        <span className="ct-graph-hot">2 in production</span>
      </div>
    </div>
  );
}
