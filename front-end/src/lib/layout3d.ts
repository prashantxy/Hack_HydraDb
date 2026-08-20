/*
 * 3D layout for dependency graphs.
 *
 * Depth is the axis that matters in this product — every API here
 * traverses by hop count — so the layout makes depth spatial: hop 0
 * sits at the origin and each level lives on its own sphere shell.
 * Within a shell, a node is placed inside a cone around its parent's
 * direction, so a subtree stays visually together and edges stay
 * short. Deterministic: same graph in, same picture out.
 */

export interface Placed {
  id: string;
  pos: [number, number, number];
  depth: number;
  /* out-degree, used for node size */
  degree: number;
  parent: string | null;
}

export interface LayoutInput {
  nodes: { id: string; depth: number }[];
  edges: { source: string; target: string }[];
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/* radius of the shell for a given depth — sub-linear so deep graphs
 * stay inside the frustum instead of marching off to infinity */
export function shellRadius(depth: number, base = 5.4) {
  return depth === 0 ? 0 : base * Math.pow(depth, 0.82);
}

/* any unit vector orthogonal to a */
function orthonormal(a: [number, number, number]) {
  const [x, y, z] = a;
  const ref: [number, number, number] =
    Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0];

  let u: [number, number, number] = [
    y * ref[2] - z * ref[1],
    z * ref[0] - x * ref[2],
    x * ref[1] - y * ref[0],
  ];
  const ul = Math.hypot(...u) || 1;
  u = [u[0] / ul, u[1] / ul, u[2] / ul];

  const v: [number, number, number] = [
    y * u[2] - z * u[1],
    z * u[0] - x * u[2],
    x * u[1] - y * u[0],
  ];

  return { u, v };
}

export function layoutGraph({ nodes, edges }: LayoutInput): {
  placed: Placed[];
  byId: Map<string, Placed>;
  maxDepth: number;
  extent: number;
} {
  const depthOf = new Map(nodes.map((n) => [n.id, n.depth]));

  /* first edge into a node wins, and only from a shallower level —
   * that keeps the spanning tree acyclic even though the graph is not */
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const degree = new Map<string, number>();

  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);

    const ds = depthOf.get(e.source);
    const dt = depthOf.get(e.target);
    if (ds === undefined || dt === undefined) continue;
    if (dt <= ds) continue;
    if (parent.has(e.target)) continue;

    parent.set(e.target, e.source);
    const list = children.get(e.source);
    if (list) list.push(e.target);
    else children.set(e.source, [e.target]);
  }

  const dir = new Map<string, [number, number, number]>();
  const byId = new Map<string, Placed>();
  const placed: Placed[] = [];

  const byDepth = new Map<number, string[]>();
  for (const n of nodes) {
    const list = byDepth.get(n.depth);
    if (list) list.push(n.id);
    else byDepth.set(n.depth, [n.id]);
  }

  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));

  const put = (id: string, d: [number, number, number], depth: number) => {
    dir.set(id, d);
    const r = shellRadius(depth);
    const p: Placed = {
      id,
      pos: [d[0] * r, d[1] * r, d[2] * r],
      depth,
      degree: degree.get(id) ?? 0,
      parent: parent.get(id) ?? null,
    };
    placed.push(p);
    byId.set(id, p);
  };

  /* roots */
  const roots = byDepth.get(0) ?? [];
  roots.forEach((id, i) => {
    if (roots.length === 1) {
      put(id, [0, 1, 0], 0);
      return;
    }
    // several roots: spread them on a small ring
    const a = (i / roots.length) * Math.PI * 2;
    put(id, [Math.cos(a), 0, Math.sin(a)], 0);
  });

  for (let d = 1; d <= maxDepth; d++) {
    const level = byDepth.get(d) ?? [];

    /* group this level by parent so each family gets its own cone */
    const families = new Map<string, string[]>();
    const orphans: string[] = [];

    for (const id of level) {
      const p = parent.get(id);
      if (p && dir.has(p)) {
        const list = families.get(p);
        if (list) list.push(id);
        else families.set(p, [id]);
      } else {
        orphans.push(id);
      }
    }

    for (const [p, kids] of families) {
      const axis = d === 1 ? null : dir.get(p)!;
      const half = d === 1 ? Math.PI : 1.05 / Math.sqrt(d);

      if (!axis) {
        /* depth 1 fans over the whole sphere — Fibonacci points give
         * an even spread with no clumping at the poles */
        kids.forEach((id, i) => {
          const y = 1 - (2 * (i + 0.5)) / kids.length;
          const rr = Math.sqrt(Math.max(0, 1 - y * y));
          const a = GOLDEN * i;
          put(id, [Math.cos(a) * rr, y, Math.sin(a) * rr], d);
        });
        continue;
      }

      const { u, v } = orthonormal(axis);

      kids.forEach((id, i) => {
        // equal-area within the cone, golden angle around it
        const theta = half * Math.sqrt((i + 0.55) / (kids.length + 0.2));
        const phi = GOLDEN * i + p.length; // stable per-parent offset
        const st = Math.sin(theta);
        const ct = Math.cos(theta);
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);

        const x = axis[0] * ct + (u[0] * cp + v[0] * sp) * st;
        const y = axis[1] * ct + (u[1] * cp + v[1] * sp) * st;
        const z = axis[2] * ct + (u[2] * cp + v[2] * sp) * st;
        const l = Math.hypot(x, y, z) || 1;

        put(id, [x / l, y / l, z / l], d);
      });
    }

    /* nodes whose parent sits on the same or a deeper level */
    orphans.forEach((id, i) => {
      const y = 1 - (2 * (i + 0.5)) / Math.max(1, orphans.length);
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const a = GOLDEN * i + 1.7;
      put(id, [Math.cos(a) * rr, y, Math.sin(a) * rr], d);
    });
  }

  return {
    placed,
    byId,
    maxDepth,
    extent: shellRadius(maxDepth) + 3,
  };
}

/* ── depth ramp ──────────────────────────────────────────────────
 * hop 0 burns accent; each level cools toward slate. Returned as
 * 0-1 rgb triples so three.Color can take them directly.
 */

const RAMP: [number, number, number][] = [
  [1, 0.35, 0.15], // #ff5a26 — the queried version
  [1, 0.56, 0.26],
  [0.95, 0.72, 0.44],
  [0.76, 0.76, 0.78],
  [0.55, 0.57, 0.62],
  [0.4, 0.42, 0.48],
];

export function depthColor(depth: number): [number, number, number] {
  return RAMP[Math.min(depth, RAMP.length - 1)];
}

export function depthHex(depth: number): string {
  const [r, g, b] = depthColor(depth);
  const h = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
