"use client";

import { useInView } from "./primitives";

/*
 * One small diagram per problem card. Each is a miniature of the
 * thing the card is about, drawn in the same language as the blast
 * graph — so the section reads as three failures of the same model,
 * not three decorative icons.
 *
 *   flat  — a scanner's output: identical rows, no hierarchy
 *   depth — the chain: reach that keeps going after you stop looking
 *   fan   — ownership: one version, several services holding the risk
 *
 * Drawn on a 132x84 grid with whole-pixel coordinates and 1.75px
 * strokes, so nothing lands on a half pixel and goes soft.
 */

export type GlyphKind = "flat" | "depth" | "fan";

const STYLE = `
  .ctg svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
    shape-rendering: geometricPrecision;
  }

  .ctg-stroke { fill: none; stroke: rgba(255,255,255,.3); stroke-width: 1.75; }
  .ctg-bar { fill: rgba(255,255,255,.2); }
  .ctg-chip { fill: rgba(255,255,255,.14); stroke: rgba(255,255,255,.34); stroke-width: 1.25; }
  .ctg-dot { fill: #000; stroke: rgba(255,255,255,.5); stroke-width: 1.75; }
  .ctg-hot { fill: var(--sig); stroke: none; }
  .ctg-hot-bar { fill: var(--sig); }
  .ctg-rule { stroke: rgba(255,255,255,.14); stroke-width: 1; }
  .ctg-tick { fill: rgba(255,255,255,.3); }

  .ctg-draw {
    stroke-dasharray: var(--len);
    stroke-dashoffset: var(--len);
  }
  .ctg.is-in .ctg-draw {
    animation: ctg-draw .75s cubic-bezier(.2,.7,.2,1) forwards;
    animation-delay: calc(var(--i, 0) * 100ms);
  }
  @keyframes ctg-draw { to { stroke-dashoffset: 0; } }

  .ctg-in { opacity: 0; }
  .ctg.is-in .ctg-in {
    animation: ctg-in .5s cubic-bezier(.2,.7,.2,1) forwards;
    animation-delay: calc(var(--i, 0) * 100ms + 120ms);
  }
  @keyframes ctg-in { to { opacity: 1; } }

  .ctg.is-in .ctg-breathe {
    animation: ctg-breathe 3.2s ease-in-out infinite;
    animation-delay: 1s;
  }
  @keyframes ctg-breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: .34; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ctg-draw { stroke-dashoffset: 0 !important; }
    .ctg-in { opacity: 1 !important; }
    .ctg-breathe { animation: none !important; }
  }
`;

/* ── flat: four rows a scanner cannot tell apart ───────────── */

function Flat() {
  const rows = [0, 1, 2, 3];

  return (
    <svg viewBox="0 0 132 84" aria-hidden focusable="false">
      {rows.map((i) => {
        const y = 8 + i * 20;
        return (
          <g key={i} style={{ ["--i" as string]: i }}>
            <rect className="ctg-in ctg-chip" x="0" y={y} width="10" height="10" rx="0" />
            {/* every bar the same length — that is the whole problem */}
            <rect className="ctg-in ctg-bar" x="18" y={y + 3.5} width="72" height="3" />
            <rect
              className={`ctg-in ${i === 2 ? "ctg-hot-bar ctg-breathe" : "ctg-tick"}`}
              x="98"
              y={y + 3.5}
              width={i === 2 ? 14 : 8}
              height="3"
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ── depth: a chain that keeps going ──────────────────────── */

function Depth() {
  const pts: [number, number][] = [
    [8, 10],
    [42, 30],
    [76, 50],
    [114, 72],
  ];

  return (
    <svg viewBox="0 0 132 84" aria-hidden focusable="false">
      {pts.slice(0, -1).map(([x, y], i) => {
        const [x2, y2] = pts[i + 1];
        const len = Math.round(Math.hypot(x2 - x, y2 - y));
        return (
          <line
            key={i}
            className="ctg-stroke ctg-draw"
            x1={x}
            y1={y}
            x2={x2}
            y2={y2}
            style={{ ["--len" as string]: `${len}`, ["--i" as string]: i }}
          />
        );
      })}

      {pts.map(([x, y], i) => {
        const last = i === pts.length - 1;
        return (
          <g key={i} style={{ ["--i" as string]: i }}>
            {last && (
              <circle
                className="ctg-in ctg-breathe"
                cx={x}
                cy={y}
                r="11"
                fill="var(--sig)"
                opacity="0.16"
              />
            )}
            <circle
              className={`ctg-in ${last ? "ctg-hot" : "ctg-dot"}`}
              cx={x}
              cy={y}
              r={last ? 6 : 5}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ── fan: one version, several owners ─────────────────────── */

function Fan() {
  const targets = [10, 38, 66];

  return (
    <svg viewBox="0 0 132 84" aria-hidden focusable="false">
      {targets.map((y, i) => {
        const d = `M 14 42 C 58 42, 62 ${y + 5}, 104 ${y + 5}`;
        return (
          <path
            key={i}
            className="ctg-stroke ctg-draw"
            d={d}
            style={{ ["--len" as string]: "112", ["--i" as string]: i }}
          />
        );
      })}

      <circle
        className="ctg-in ctg-breathe"
        cx="14"
        cy="42"
        r="14"
        fill="var(--sig)"
        opacity="0.16"
        style={{ ["--i" as string]: 0 }}
      />
      <circle
        className="ctg-in ctg-hot"
        cx="14"
        cy="42"
        r="6.5"
        style={{ ["--i" as string]: 0 }}
      />

      {targets.map((y, i) => (
        <g key={i} style={{ ["--i" as string]: i + 1 }}>
          <rect className="ctg-in ctg-chip" x="104" y={y} width="11" height="11" />
          <rect
            className="ctg-in ctg-tick"
            x="121"
            y={y + 4}
            width={i === 2 ? 5 : 9}
            height="3"
          />
        </g>
      ))}
    </svg>
  );
}

const GLYPHS: Record<GlyphKind, () => React.ReactElement> = {
  flat: Flat,
  depth: Depth,
  fan: Fan,
};

export function Glyph({ kind }: { kind: GlyphKind }) {
  const { ref, seen } = useInView<HTMLDivElement>(0.3);
  const Shape = GLYPHS[kind];

  return (
    <div ref={ref} className={`ctg ${seen ? "is-in" : ""}`}>
      <style>{STYLE}</style>
      <Shape />
    </div>
  );
}
