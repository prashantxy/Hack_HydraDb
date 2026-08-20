"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { type GraphNodeData } from "@/lib/graph-data";
import { scrollStore, smoothstep } from "@/lib/scroll-store";

// Light colors for dark background
const NODE_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#facc15",
  LOW: "#4ade80",
  package: "#d4d4d8",
  service: "#60a5fa",
  environment: "#a78bfa",
};

function getNodeColor(data: GraphNodeData): string {
  if (data.severity) return NODE_COLORS[data.severity] || "#d4d4d8";
  return NODE_COLORS[data.type] || "#d4d4d8";
}

interface GraphNodeProps {
  data: GraphNodeData;
}

export function GraphNode({ data }: GraphNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const restPos = useMemo(
    () => new THREE.Vector3(...data.restPosition),
    [data.restPosition]
  );
  const origin = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);

  const nodeColor = useMemo(() => new THREE.Color(getNodeColor(data)), [data]);
  const criticalColor = useMemo(() => new THREE.Color("#ef4444"), []);
  const currentColor = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const p = scrollStore.progress;
    const t = smoothstep(data.appearAt, data.appearAt + 0.12, p);
    const blastT = smoothstep(0.78, 0.92, p);

    if (!groupRef.current) return;

    // Position: lerp from origin to rest position
    tempPos.lerpVectors(origin, restPos, t);
    groupRef.current.position.copy(tempPos);

    // Scale: pop in
    const scale = t * data.radius * 2;
    groupRef.current.scale.setScalar(Math.max(0.001, scale));

    // Color animation
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      currentColor.copy(nodeColor);

      if (data.onCriticalPath && blastT > 0) {
        currentColor.lerp(criticalColor, blastT * 0.7);
      }
      mat.color.copy(currentColor);

      // Emissive glow
      if (data.onCriticalPath && blastT > 0) {
        mat.emissive.copy(criticalColor);
        mat.emissiveIntensity = blastT * 0.5;
      } else if (data.severity === "CRITICAL") {
        mat.emissive.copy(criticalColor);
        mat.emissiveIntensity = 0.15;
      } else {
        mat.emissive.copy(nodeColor);
        mat.emissiveIntensity = 0.08;
      }
    }

    // Glow ring
    if (glowRef.current) {
      const isCritical = data.severity === "CRITICAL" || (data.onCriticalPath && blastT > 0);
      const glowScale = isCritical ? 2.0 : 1.3;
      glowRef.current.scale.setScalar(
        Math.max(0.001, glowScale * t * data.radius * 2)
      );
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;

      if (data.onCriticalPath && blastT > 0) {
        glowMat.opacity = blastT * 0.2;
        glowMat.color.copy(criticalColor);
      } else if (data.severity === "CRITICAL") {
        glowMat.opacity = 0.1;
        glowMat.color.copy(criticalColor);
      } else {
        glowMat.opacity = 0.04;
        glowMat.color.copy(nodeColor);
      }
    }
  });

  const fontSize = data.type === "environment" ? 0.2 : 0.13;

  return (
    <group ref={groupRef}>
      {/* Glow ring */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.3, 32]} />
        <meshBasicMaterial
          color={nodeColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Main node */}
      <mesh ref={meshRef}>
        {data.type === "service" ? (
          <octahedronGeometry args={[1, 0]} />
        ) : data.type === "environment" ? (
          <cylinderGeometry args={[1.2, 1.2, 0.3, 6]} />
        ) : (
          <sphereGeometry args={[1, 32, 32]} />
        )}
        <meshStandardMaterial
          color={nodeColor}
          roughness={0.35}
          metalness={0.15}
          emissive={new THREE.Color("#000000")}
          emissiveIntensity={0}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, data.type === "environment" ? -0.6 : -1.6, 0]}
        fontSize={fontSize}
        color="#ffffff"
        anchorX="center"
        anchorY="top"
        letterSpacing={0.02}
        fontWeight="bold"
        fillOpacity={0.8}
      >
        {data.label}
      </Text>
    </group>
  );
}
