"use client";

import { Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { GraphNode } from "./graph-node";
import { GraphEdge } from "./graph-edge";
import {
  graphNodes,
  graphEdges,
  cameraKeyframes,
} from "@/lib/graph-data";
import { scrollStore, lerp } from "@/lib/scroll-store";

// ── Camera controller ────────────────────────────────────────

function CameraController() {
  const { camera } = useThree();
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLookAt = useMemo(() => new THREE.Vector3(), []);
  const currentLookAt = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const p = scrollStore.progress;

    // Find the two keyframes we're between
    let kf0 = cameraKeyframes[0];
    let kf1 = cameraKeyframes[cameraKeyframes.length - 1];

    for (let i = 0; i < cameraKeyframes.length - 1; i++) {
      if (p >= cameraKeyframes[i].scroll && p <= cameraKeyframes[i + 1].scroll) {
        kf0 = cameraKeyframes[i];
        kf1 = cameraKeyframes[i + 1];
        break;
      }
    }

    const range = kf1.scroll - kf0.scroll;
    const t = range > 0 ? (p - kf0.scroll) / range : 0;
    const smoothT = t * t * (3 - 2 * t);

    targetPos.set(
      lerp(kf0.position[0], kf1.position[0], smoothT),
      lerp(kf0.position[1], kf1.position[1], smoothT),
      lerp(kf0.position[2], kf1.position[2], smoothT)
    );
    camera.position.lerp(targetPos, 0.08);

    targetLookAt.set(
      lerp(kf0.lookAt[0], kf1.lookAt[0], smoothT),
      lerp(kf0.lookAt[1], kf1.lookAt[1], smoothT),
      lerp(kf0.lookAt[2], kf1.lookAt[2], smoothT)
    );
    currentLookAt.lerp(targetLookAt, 0.08);
    camera.lookAt(currentLookAt);
  });

  return null;
}

// ── Main scene ───────────────────────────────────────────────

function Scene() {
  return (
    <>
      <CameraController />

      {/* Lighting — soft and atmospheric */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 12, 8]} intensity={0.6} color="#e8e8ff" />
      <directionalLight position={[-5, 8, -5]} intensity={0.25} color="#c0c8ff" />
      <pointLight position={[0, 4, 6]} intensity={0.15} color="#ffffff" />

      {/* Fog — blends distant objects into the dark atmosphere */}
      <fog attach="fog" args={["#08080c", 18, 55]} />

      {/* Graph edges */}
      {graphEdges.map((edge) => {
        const sourceNode = graphNodes.find((n) => n.id === edge.source);
        const targetNode = graphNodes.find((n) => n.id === edge.target);
        if (!sourceNode || !targetNode) return null;
        return (
          <GraphEdge
            key={`${edge.source}-${edge.target}`}
            data={edge}
            sourceNode={sourceNode}
            targetNode={targetNode}
          />
        );
      })}

      {/* Graph nodes */}
      {graphNodes.map((node) => (
        <Float
          key={node.id}
          speed={1.2}
          rotationIntensity={0}
          floatIntensity={node.type === "package" ? 0.25 : 0.08}
          floatingRange={[-0.04, 0.04]}
        >
          <GraphNode data={node} />
        </Float>
      ))}
    </>
  );
}

// ── Canvas wrapper ───────────────────────────────────────────

export function GraphScene() {
  return (
    <div className="graph-canvas-wrapper">
      <Canvas
        camera={{
          fov: 45,
          near: 0.1,
          far: 100,
          position: [0, 0.5, 12],
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
