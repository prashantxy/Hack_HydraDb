/*
 * Generates public/hero-blast.png — the luminance source for the hero
 * ASCII renderer. It is a dependency graph seen as a blast: one
 * compromised version at the centre, DEPENDS_ON edges radiating out,
 * services lighting up at the rim.
 *
 * Run: node scripts/gen-hero-image.mjs
 * Swap the PNG for a real render any time; only luminance matters.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const W = 760;
const H = 760;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "hero-blast.png",
);

/* ── deterministic noise ─────────────────────────────────── */

let seed = 0x9e3779b9;
function rnd() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 100000) / 100000;
}

/* ── canvas ──────────────────────────────────────────────── */

const buf = new Float32Array(W * H);

function add(x, y, v) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  buf[yi * W + xi] += v;
}

function blob(cx, cy, radius, peak) {
  const r2 = radius * radius;
  for (let y = Math.max(0, cy - radius) | 0; y < Math.min(H, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius) | 0; x < Math.min(W, cx + radius); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      const f = 1 - Math.sqrt(d2) / radius;
      add(x, y, peak * f * f);
    }
  }
}

function line(x1, y1, x2, y2, peak, thickness) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // fade along the edge — near the source is hotter
    const fade = 1 - t * 0.55;
    blob(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness, peak * fade * 0.34);
  }
}

/* ── the graph ───────────────────────────────────────────── */

const CX = W * 0.5;
const CY = H * 0.5;

// ring radii read as traversal depth: 0 → 4 hops
const RINGS = [
  { r: 130, n: 5, node: 34, edge: 1.0 },
  { r: 240, n: 8, node: 27, edge: 0.95 },
  { r: 330, n: 11, node: 20, edge: 0.8 },
];

const layers = [[{ x: CX, y: CY }]];

for (const ring of RINGS) {
  const prev = layers[layers.length - 1];
  const nodes = [];
  const spin = rnd() * Math.PI * 2;
  for (let i = 0; i < ring.n; i++) {
    const a = spin + (i / ring.n) * Math.PI * 2 + (rnd() - 0.5) * 0.22;
    const rr = ring.r * (0.88 + rnd() * 0.24);
    nodes.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr * 0.94 });
  }
  // wire each node back to its nearest parent — a real traversal shape
  for (const n of nodes) {
    let best = prev[0];
    let bd = Infinity;
    for (const p of prev) {
      const d = (p.x - n.x) ** 2 + (p.y - n.y) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    line(best.x, best.y, n.x, n.y, ring.edge, 9);
    blob(n.x, n.y, ring.node, ring.edge * 1.3);
    blob(n.x, n.y, ring.node * 1.9, ring.edge * 0.34);
  }
  layers.push(nodes);
}

// the compromised version at the centre — the brightest thing on the page
blob(CX, CY, 60, 1.7);
blob(CX, CY, 120, 0.45);

// a few long cross-links: transitive reach that skips a level
for (let i = 0; i < 6; i++) {
  const a = layers[1 + ((rnd() * 2) | 0)];
  const b = layers[2 + ((rnd() * 2) | 0)];
  const p = a[(rnd() * a.length) | 0];
  const q = b[(rnd() * b.length) | 0];
  line(p.x, p.y, q.x, q.y, 0.6, 6);
}

/* ── grain + vignette, then encode ───────────────────────── */

const px = Buffer.alloc(W * H * 4);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = buf[i];

    // vignette so the ASCII field dissolves at the edges
    const d = Math.hypot((x - CX) / (W * 0.5), (y - CY) / (H * 0.5));
    v *= Math.max(0, 1 - Math.pow(d, 2.8) * 0.85);

    v += (rnd() - 0.5) * 0.05 * Math.min(1, v * 6);
    v = Math.max(0, Math.min(1, v));

    const g = Math.round(Math.pow(Math.min(1, v), 0.65) * 255);
    const o = i * 4;
    px[o] = g;
    px[o + 1] = g;
    px[o + 2] = g;
    px[o + 3] = g > 14 ? 255 : 0;
  }
}

/* ── minimal PNG writer ──────────────────────────────────── */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(b) {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // no filter
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);

console.log(`wrote ${OUT} (${W}x${H})`);
