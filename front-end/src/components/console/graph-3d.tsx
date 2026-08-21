"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  depthColor,
  layoutGraph,
  shellRadius,
} from "@/lib/layout3d";

/*
 * The dependency graph in three dimensions, with hop depth as the
 * radial axis: the queried version sits at the origin and each hop
 * lives on its own shell. Shell outlines are drawn so depth is
 * readable without counting edges.
 *
 * Nodes are one instanced mesh and edges are one line-segment mesh,
 * so the whole scene is a handful of draw calls. Rather than moving
 * the camera to fit the data, the graph is scaled to a fixed radius
 * — the camera and the controls then agree about where everything
 * is, whatever the depth.
 *
 * Selecting a node flies the camera to it and defocuses everything
 * off its path: those nodes grow and darken toward the background,
 * which reads as depth of field without a postprocessing pass — and
 * unlike a real one, it tracks the selection rather than distance,
 * so the whole chain back to hop 0 stays sharp at any depth.
 */

export interface Node3D {
  id: string;
  label: string;
  sublabel?: string;
  depth: number;
  /* replaces the "hop N" line — the blast view places services on a
   * shell that is not their true hop count, so it says its own */
  meta?: string;
  /* overrides the depth ramp — the blast view passes severity */
  color?: [number, number, number];
}

export interface Edge3D {
  source: string;
  target: string;
  kind?: string | null;
}

export interface Graph3DProps {
  nodes: Node3D[];
  edges: Edge3D[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  autoRotate?: boolean;
}

/* group-local to world: the group only carries a uniform scale */
const worldOf = (
  p: [number, number, number],
  scale: number,
): [number, number, number] => [p[0] * scale, p[1] * scale, p[2] * scale];

/* the graph is always drawn inside a sphere of this radius */
const FIT = 11.5;

/* camera distance when a node is focused, and when nothing is */
const FOCUS_DISTANCE = 11;
const HOME_DISTANCE = 30;

export function Graph3D(props: Graph3DProps) {
  return (
    <div className="cs-canvas">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 45, position: [0, 5.5, 30], near: 0.5, far: 110 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}

function Scene({
  nodes,
  edges,
  selected,
  onSelect,
  autoRotate = true,
}: Graph3DProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState(false);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const layout = useMemo(() => layoutGraph({ nodes, edges }), [nodes, edges]);

  /* one scale for the whole graph, so depth 1 and depth 5 both frame */
  const scale = FIT / Math.max(4, layout.extent);

  const colorOf = useMemo(() => {
    const m = new Map<string, [number, number, number]>();
    for (const n of nodes) m.set(n.id, n.color ?? depthColor(n.depth));
    return m;
  }, [nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  /* ancestor chain of the selection: the path back to hop 0 */
  const chain = useMemo(() => {
    const set = new Set<string>();
    let cur = selected ?? null;
    let guard = 0;
    while (cur && guard++ < 64) {
      set.add(cur);
      cur = layout.byId.get(cur)?.parent ?? null;
    }
    return set;
  }, [selected, layout]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect?.(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelect]);

  /* ── node instances ── */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const m = new THREE.Matrix4();
    const c = new THREE.Color();

    layout.placed.forEach((p, i) => {
      const lit = !selected || chain.has(p.id);

      const base = Math.max(
        0.2,
        0.3 + Math.min(0.62, Math.sqrt(p.degree) * 0.14) - p.depth * 0.015,
      );

      /* defocused nodes bloom outward and sink toward the background:
       * bigger and dimmer is what an out-of-focus point looks like */
      const size =
        base * (p.id === selected ? 2 : lit ? 1.15 : 1.3);

      m.makeScale(size, size, size);
      m.setPosition(p.pos[0], p.pos[1], p.pos[2]);
      mesh.setMatrixAt(i, m);

      const [r, g, b] = colorOf.get(p.id) ?? [0.7, 0.7, 0.7];
      const k = lit ? 1 : 0.13;
      c.setRGB(r * k, g * k, b * k);
      mesh.setColorAt(i, c);
    });

    mesh.count = layout.placed.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [layout, colorOf, selected, chain]);

  /* ── edges: one buffer, coloured per endpoint depth ── */
  const edgeGeo = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];

    for (const e of edges) {
      const a = layout.byId.get(e.source);
      const b = layout.byId.get(e.target);
      if (!a || !b) continue;

      const lit = !selected || (chain.has(e.source) && chain.has(e.target));
      const k = lit ? 0.95 : 0.09;

      pos.push(...a.pos, ...b.pos);

      const ca = depthColor(a.depth);
      const cb = depthColor(b.depth);
      col.push(ca[0] * k, ca[1] * k, ca[2] * k);
      col.push(cb[0] * k * 0.75, cb[1] * k * 0.75, cb[2] * k * 0.75);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }, [edges, layout, selected, chain]);

  useEffect(() => () => edgeGeo.dispose(), [edgeGeo]);

  /* ── depth shells: an equator and a meridian per hop level ── */
  const shellGeo = useMemo(() => {
    const pts: number[] = [];
    const SEG = 84;

    for (let d = 1; d <= layout.maxDepth; d++) {
      const r = shellRadius(d);
      for (let i = 0; i < SEG; i++) {
        const a0 = (i / SEG) * Math.PI * 2;
        const a1 = ((i + 1) / SEG) * Math.PI * 2;
        pts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r);
        pts.push(Math.cos(a1) * r, 0, Math.sin(a1) * r);
        pts.push(Math.cos(a0) * r, Math.sin(a0) * r, 0);
        pts.push(Math.cos(a1) * r, Math.sin(a1) * r, 0);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [layout.maxDepth]);

  useEffect(() => () => shellGeo.dispose(), [shellGeo]);

  const label = (id: string | null) => {
    if (!id) return null;
    const p = layout.byId.get(id);
    const n = nodeById.get(id);
    return p && n ? { p, n } : null;
  };

  const pinned = label(selected ?? null);
  const hover = label(hovered);
  const count = Math.max(1, layout.placed.length);

  /* the group only carries a scale, so world space is local * scale */
  const focusPoint = useMemo(() => {
    if (!pinned) return null;
    const [x, y, z] = pinned.p.pos;
    return new THREE.Vector3(x * scale, y * scale, z * scale);
  }, [pinned, scale]);

  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        zoomSpeed={1.15}
        minDistance={1.2}
        maxDistance={260}
        autoRotate={autoRotate && !reduce && !selected && !grabbed}
        onStart={() => setGrabbed(true)}
        autoRotateSpeed={0.42}
      />

      <FocusRig focusKey={selected ?? null} point={focusPoint} />

      {/* clicking past the graph clears the selection. A transparent
        * mesh is still raycastable, so this is an ordinary hit rather
        * than onPointerMissed, which also fires on real hits and was
        * cancelling every selection. */}
      <mesh onClick={() => onSelect?.(null)}>
        <sphereGeometry args={[95, 8, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      <group scale={scale}>
        <lineSegments geometry={shellGeo}>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </lineSegments>

        <lineSegments geometry={edgeGeo}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        <instancedMesh
          key={count}
          ref={meshRef}
          args={[undefined, undefined, count]}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.instanceId === undefined) return;
            setHovered(layout.placed[e.instanceId]?.id ?? null);
          }}
          onPointerOut={() => setHovered(null)}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId === undefined) return;
            const id = layout.placed[e.instanceId]?.id ?? null;
            onSelect?.(id === selected ? null : id);
          }}
        >
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>

      </group>

      {/* labels live outside the scaled group so their on-screen size
        * is set by camera distance alone, not by the graph's scale */}
      {pinned && (
        <Html
          position={worldOf(pinned.p.pos, scale)}
          center
          zIndexRange={[20, 10]}
        >
          <div className="cs-tip cs-tip-pin">
            <b>{pinned.n.label}</b>
            <span>
              {pinned.n.meta ?? `hop ${pinned.n.depth}`}
              {pinned.n.sublabel ? ` · ${pinned.n.sublabel}` : ""}
            </span>
          </div>
        </Html>
      )}

      {hover && hovered !== selected && (
        <Html
          position={worldOf(hover.p.pos, scale)}
          center
          zIndexRange={[19, 10]}
        >
          <div className="cs-tip">
            <b>{hover.n.label}</b>
            <span>
              {hover.n.meta ?? `hop ${hover.n.depth}`}
              {hover.n.sublabel ? ` · ${hover.n.sublabel}` : ""}
            </span>
          </div>
        </Html>
      )}
    </>
  );
}

/* ── focus rig ────────────────────────────────────────────────
 * Flies the orbit target to the selected node and settles the
 * camera at a close distance along the current view direction, then
 * stops touching either — so the user can orbit the focused node
 * without the animation fighting them.
 */

function FocusRig({
  focusKey,
  point,
}: {
  focusKey: string | null;
  point: THREE.Vector3 | null;
}) {
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher & {
        target: THREE.Vector3;
        update: () => void;
      })
    | null;
  const camera = useThree((s) => s.camera);

  const goal = useRef(new THREE.Vector3());
  const distance = useRef(HOME_DISTANCE);
  const settled = useRef(true);

  useEffect(() => {
    goal.current.copy(point ?? new THREE.Vector3(0, 0, 0));
    distance.current = point ? FOCUS_DISTANCE : HOME_DISTANCE;
    settled.current = false;
  }, [focusKey, point]);

  useFrame((_, dt) => {
    if (settled.current || !controls) return;

    // frame-rate independent easing
    const k = 1 - Math.exp(-dt * 4.2);

    controls.target.lerp(goal.current, k);

    const dir = camera.position.clone().sub(controls.target);
    const current = dir.length() || 1;
    dir.normalize();

    const next = THREE.MathUtils.lerp(current, distance.current, k);
    camera.position.copy(controls.target).addScaledVector(dir, next);
    controls.update();

    if (
      controls.target.distanceTo(goal.current) < 0.02 &&
      Math.abs(next - distance.current) < 0.06
    ) {
      settled.current = true;
    }
  });

  return null;
}
