"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ── in-view reveal ──────────────────────────────────────────
 * Adds .is-in once, on first intersection. One observer per
 * block; CSS does the staggering off --i.
 */

export function useInView<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);

  return { ref, seen };
}

export function Reveal({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "ul" | "dl";
}) {
  const { ref, seen } = useInView<HTMLDivElement>();

  return (
    <Tag
      ref={ref as never}
      className={`ct-reveal ${seen ? "is-in" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

/* ── corner ticks ────────────────────────────────────────────
 * Registration marks on a framed panel — the same marks a
 * plotter leaves. Purely decorative, so hidden from a11y.
 */

export function Ticks() {
  return (
    <>
      <i className="ct-tick ct-tick-tl" aria-hidden />
      <i className="ct-tick ct-tick-tr" aria-hidden />
      <i className="ct-tick ct-tick-bl" aria-hidden />
      <i className="ct-tick ct-tick-br" aria-hidden />
    </>
  );
}

export function Frame({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`ct-frame ${className}`.trim()} style={style}>
      <Ticks />
      {children}
    </div>
  );
}

/* ── pixel arrow ─────────────────────────────────────────────
 * A dot-matrix arrow drawn on a 5x5 grid. Animates on the
 * parent button's hover: the tail dots march forward.
 */

export function PixelArrow() {
  const cells = [
    [4, 0],
    [3, 0],
    [4, 1],
    [2, 1],
    [4, 2],
    [1, 2],
    [4, 3],
    [4, 4],
    [0, 3],
    [3, 3],
    [2, 2],
  ];

  return (
    <svg className="ct-arrow" viewBox="0 0 5 5" aria-hidden focusable="false">
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

/* ── wordmark ────────────────────────────────────────────────
 * CHAINTRACE set in a 5x7 dot matrix — the same grid the CLI
 * banner is drawn on. Each glyph is a bitmask column set.
 */

const GLYPHS: Record<string, string[]> = {
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
};

export function Wordmark({ text = "CHAINTRACE" }: { text?: string }) {
  const letters = text.split("");
  const cw = 6; // 5 columns + 1 gap
  const width = letters.length * cw - 1;

  return (
    <svg
      viewBox={`0 0 ${width} 7`}
      role="img"
      aria-label={text}
      shapeRendering="crispEdges"
    >
      {letters.flatMap((ch, li) => {
        const rows = GLYPHS[ch];
        if (!rows) return [];
        return rows.flatMap((row, y) =>
          row
            .split("")
            .map((bit, x) =>
              bit === "1" ? (
                <rect
                  key={`${li}-${x}-${y}`}
                  x={li * cw + x}
                  y={y}
                  width="1"
                  height="1"
                  fill="currentColor"
                />
              ) : null,
            )
            .filter(Boolean),
        );
      })}
    </svg>
  );
}

/* ── card glyph ──────────────────────────────────────────────
 * A 3x3 dot matrix per problem card, where the lit cells say
 * what the card is about: a flat list, a deep chain, a fan-out.
 */

export type MatrixKind = "list" | "chain" | "fan";

const MATRIX: Record<MatrixKind, [number, number][]> = {
  list: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  chain: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  fan: [
    [1, 1],
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
};

export function Matrix({ kind }: { kind: MatrixKind }) {
  const lit = new Set(MATRIX[kind].map(([x, y]) => `${x}${y}`));
  const cells: ReactNode[] = [];

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const on = lit.has(`${x}${y}`);
      cells.push(
        <rect
          key={`${x}${y}`}
          x={x * 9}
          y={y * 9}
          width="5"
          height="5"
          fill={on ? "var(--fg-3)" : "currentColor"}
          opacity={on ? 1 : 0.45}
        />,
      );
    }
  }

  return (
    <svg className="ct-matrix" viewBox="-1 -1 25 25" aria-hidden focusable="false">
      {cells}
    </svg>
  );
}

/* ── hatch band ──────────────────────────────────────────── */

export function Hatch() {
  return <div className="ct-hatch" aria-hidden />;
}

/* ── count-up ────────────────────────────────────────────────
 * Counts to the target once the strip scrolls into view. Holds
 * at the target for reduced-motion users.
 */

export function CountUp({
  to,
  decimals = 0,
  suffix = "",
  duration = 1100,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const { ref, seen } = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!seen) return;

    let raf = 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic: fast readout that settles, like a counter
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);

  return (
    <span ref={ref}>
      {value.toFixed(decimals)}
      {suffix ? <em>{suffix}</em> : null}
    </span>
  );
}
