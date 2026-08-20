"use client";

import { useEffect, useRef } from "react";

/*
 * Two canvas pieces that close the page out in the same dot-matrix
 * language as the wordmark and the hero ASCII field.
 *
 *   PixelWaves    — a halftone dot field with a slow wave running
 *                   through it, sitting behind the final call.
 *   PixelWordmark — CHAINTRACE punched into a full-width dot grid,
 *                   with the lit cells drifting through the accent.
 *
 * Both are decorative, so they are aria-hidden, they draw a single
 * static frame under prefers-reduced-motion, and they stop drawing
 * when scrolled out of view.
 */

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) => void;

/* shared canvas driver: DPR sizing, resize, rAF, visibility */
function useCanvas(draw: DrawFn) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const start = performance.now();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (now: number) => {
      if (visible) draw(ctx, w, h, (now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(() => {
      size();
      if (reduce) draw(ctx, w, h, 0);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(canvas);

    size();

    if (reduce) {
      draw(ctx, w, h, 0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [draw]);

  return ref;
}

/* ── halftone waves ──────────────────────────────────────────
 * Diagonal bands drift across a fixed dot grid. Dot radius and
 * colour both track the field value, so the bands read as light
 * passing over a screen rather than shapes moving.
 */

const CELL = 11;

function drawWaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);

  const cols = Math.ceil(w / CELL) + 1;
  const rows = Math.ceil(h / CELL) + 1;
  const cx = cols / 2;
  const cy = rows / 2;

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      // two diagonal waves, one warped by the other
      const warp = Math.sin(ry * 0.13 - t * 0.34) * 2.1;
      const band = Math.sin((rx * 0.9 + ry * 1.15) * 0.11 + t * 0.5 + warp);
      const slow = Math.sin((rx * 0.6 - ry * 0.5) * 0.05 - t * 0.22);

      let v = 0.5 + 0.5 * (band * 0.74 + slow * 0.26);
      v = Math.pow(v, 2.1); // tighten the bands into ridges

      // only a light hollow in the middle — the card is opaque, so
      // the field can stay bright right up to its edges
      const dx = (rx - cx) / cx;
      const dy = (ry - cy) / cy;
      const centre = Math.min(1, Math.hypot(dx * 0.8, dy * 1.15));
      v *= 0.5 + 0.5 * Math.pow(centre, 1.3);

      if (v < 0.035) continue;

      const r = 1 + v * 3.1;
      // dim → accent → hot white as the ridge peaks
      const k = Math.min(1, v * 1.25);
      const cr = Math.round(110 + 145 * k);
      const cg = Math.round(38 + 190 * Math.pow(k, 2.1));
      const cb = Math.round(20 + 195 * Math.pow(k, 3.2));

      ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.24 + v * 0.76).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(rx * CELL, ry * CELL, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function PixelWaves() {
  const ref = useCanvas(drawWaves);
  return <canvas ref={ref} className="ct-waves" aria-hidden />;
}

/* ── dot-matrix wordmark ─────────────────────────────────────
 * The same 5x7 bitmap the nav wordmark uses, blown up to the full
 * container width and punched into a grid of dim dots.
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

const WORD = "CHAINTRACE";
const GLYPH_COLS = WORD.length * 6 - 1; // 5 columns + 1 gap per letter
const GLYPH_ROWS = 7;

/* lit(col,row) for the whole word, as a lookup */
const LIT = (() => {
  const set = new Set<string>();
  WORD.split("").forEach((ch, li) => {
    const rows = GLYPHS[ch];
    if (!rows) return;
    rows.forEach((row, y) => {
      row.split("").forEach((bit, x) => {
        if (bit === "1") set.add(`${li * 6 + x},${y}`);
      });
    });
  });
  return set;
})();

function drawWordmark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);

  // one cell across the full width, letters vertically centred
  const cell = w / GLYPH_COLS;
  const r = Math.max(1.3, cell * 0.26);
  const gridRows = Math.ceil(h / cell);
  const yOffset = (h - GLYPH_ROWS * cell) / 2;
  const rowShift = Math.round(yOffset / cell);

  for (let ry = -1; ry <= gridRows; ry++) {
    for (let rx = 0; rx < GLYPH_COLS; rx++) {
      const gy = ry - rowShift;
      const lit = LIT.has(`${rx},${gy}`);

      const x = rx * cell + cell / 2;
      const y = ry * cell + (yOffset % cell) + cell / 2;

      if (lit) {
        // a slow diagonal sweep decides which lit cells burn accent
        const sweep = Math.sin((rx * 0.9 + gy * 1.6) * 0.13 - t * 0.85);
        const hot = Math.max(0, sweep);
        const a = 0.4 + hot * 0.55;
        const cg = Math.round(120 + 130 * (1 - hot));
        const cb = Math.round(110 + 140 * (1 - hot));
        ctx.fillStyle = `rgba(255,${cg},${cb},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, r * (1 + hot * 0.22), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function PixelWordmark() {
  const ref = useCanvas(drawWordmark);
  return (
    <div className="ct-bigmark">
      <canvas ref={ref} aria-hidden />
      <span className="ct-sr">ChainTrace</span>
    </div>
  );
}
