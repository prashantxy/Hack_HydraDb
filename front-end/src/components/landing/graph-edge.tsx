"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type GraphEdgeData, type GraphNodeData } from "@/lib/graph-data";
import { scrollStore, smoothstep } from "@/lib/scroll-store";

interface GraphEdgeProps {
  data: GraphEdgeData;
  sourceNode: GraphNodeData;
  targetNode: GraphNodeData;
}

export function GraphEdge({ data, sourceNode, targetNode }: GraphEdgeProps) {
  const lineRef = useRef<THREE.Line>(null);

  const sourceRest = useMemo(
    () => new THREE.Vector3(...sourceNode.restPosition),
    [sourceNode.restPosition]
  );
  const targetRest = useMemo(
    () => new THREE.Vector3(...targetNode.restPosition),
    [targetNode.restPosition]
  );
  const origin = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tempSource = useMemo(() => new THREE.Vector3(), []);
  const tempTarget = useMemo(() => new THREE.Vector3(), []);

  const baseColor = useMemo(() => new THREE.Color("#555566"), []);
  const criticalColor = useMemo(() => new THREE.Color("#ef4444"), []);
  const fadedColor = useMemo(() => new THREE.Color("#1a1a22"), []);

  useFrame(() => {
    const p = scrollStore.progress;
    const sourceT = smoothstep(sourceNode.appearAt, sourceNode.appearAt + 0.12, p);
    const targetT = smoothstep(targetNode.appearAt, targetNode.appearAt + 0.12, p);
    const edgeT = Math.min(sourceT, targetT);
    const blastT = smoothstep(0.78, 0.92, p);

    if (!lineRef.current) return;

    // Update line positions
    tempSource.lerpVectors(origin, sourceRest, sourceT);
    tempTarget.lerpVectors(origin, targetRest, targetT);

    const positions = lineRef.current.geometry.attributes.position;
    if (positions) {
      const arr = positions.array as Float32Array;
      arr[0] = tempSource.x;
      arr[1] = tempSource.y;
      arr[2] = tempSource.z;
      arr[3] = tempTarget.x;
      arr[4] = tempTarget.y;
      arr[5] = tempTarget.z;
      positions.needsUpdate = true;
    }

    // Update material
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    mat.opacity = edgeT * 0.4;

    if (data.onCriticalPath && blastT > 0) {
      mat.color.copy(criticalColor);
      mat.opacity = edgeT * (0.3 + blastT * 0.7);
    } else if (blastT > 0 && !data.onCriticalPath) {
      mat.color.copy(fadedColor);
      mat.opacity = edgeT * 0.1 * (1 - blastT * 0.8);
    } else {
      mat.color.copy(baseColor);
    }
  });

  const initialPositions = useMemo(() => {
    return new Float32Array([0, 0, 0, 0, 0, 0]);
  }, []);

  return (
    <line ref={lineRef as any}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initialPositions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={baseColor}
        transparent
        opacity={0}
        linewidth={1}
      />
    </line>
  );
}
