"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Text, Line } from "@react-three/drei";
import * as THREE from "three";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface NodeData {
  id: string;
  label: string;
  type: "package" | "service";
  severity?: Severity;
  environment?: string;
  position: [number, number, number];
}

interface EdgeData {
  source: string;
  target: string;
  hops?: number;
}

const severityColor: Record<Severity, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const graphNodes: NodeData[] = [
  { id: "axios", label: "axios@1.7.2", type: "package", severity: "CRITICAL", position: [0, 3, 0] },
  { id: "formdata", label: "form-data@4.0.6", type: "package", severity: "CRITICAL", position: [-3, 1.5, 0.5] },
  { id: "redirects", label: "follow-redirects", type: "package", severity: "HIGH", position: [3, 1.5, -0.5] },
  { id: "mime", label: "mime-types@2.1.35", type: "package", severity: "HIGH", position: [-1.5, 0, 1] },
  { id: "checkout", label: "checkout-service", type: "service", environment: "production", severity: "CRITICAL", position: [-4, -1.5, 0] },
  { id: "payment", label: "payment-api", type: "service", environment: "production", severity: "CRITICAL", position: [0, -1.5, 0] },
  { id: "analytics", label: "analytics-api", type: "service", environment: "production", severity: "MEDIUM", position: [4, -1.5, 0] },
];

const graphEdges: EdgeData[] = [
  { source: "axios", target: "formdata" },
  { source: "axios", target: "redirects" },
  { source: "formdata", target: "mime" },
  { source: "redirects", target: "mime" },
  { source: "payment", target: "axios" },
  { source: "checkout", target: "formdata" },
  { source: "analytics", target: "mime" },
];

function GraphNode({ node }: { node: NodeData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const color = node.severity ? severityColor[node.severity] : "#3b82f6";
  const isService = node.type === "service";
  const size = isService ? 0.38 : 0.25;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        node.position[1] + Math.sin(state.clock.elapsedTime * 0.5 + node.position[0]) * 0.08;
    }
    if (glowRef.current) {
      glowRef.current.position.y =
        node.position[1] + Math.sin(state.clock.elapsedTime * 0.5 + node.position[0]) * 0.08;
      glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.05);
    }
  });

  return (
    <group position={node.position}>
      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 1.8, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} />
      </mesh>
      {/* Node */}
      <mesh ref={meshRef}>
        {isService ? (
          <boxGeometry args={[size * 2, size * 1.2, size * 1.2]} />
        ) : (
          <sphereGeometry args={[size, 24, 24]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {/* Label */}
      <Text
        position={[0, isService ? -0.6 : -0.45, 0]}
        fontSize={0.18}
        color="#a1a1aa"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter.woff"
        characters="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@.-_/"
      >
        {node.label}
      </Text>
      {isService && node.environment && (
        <Text
          position={[0, 0.8, 0]}
          fontSize={0.11}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {node.environment}
        </Text>
      )}
    </group>
  );
}

function GraphEdges() {
  const nodeMap = useMemo(() => {
    const m = new Map<string, NodeData>();
    graphNodes.forEach((n) => m.set(n.id, n));
    return m;
  }, []);

  return (
    <>
      {graphEdges.map((edge, i) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) return null;
        return (
          <Line
            key={i}
            points={[
              [s.position[0], s.position[1], s.position[2]],
              [t.position[0], t.position[1], t.position[2]],
            ]}
            color="#27272a"
            lineWidth={1.2}
            transparent
            opacity={0.5}
          />
        );
      })}
    </>
  );
}

function FloatingParticles() {
  const count = 40;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, []);

  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#3b82f6" size={0.02} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

function GraphScene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />
      <pointLight position={[-10, -5, 5]} intensity={0.3} color="#3b82f6" />
      <FloatingParticles />
      <GraphEdges />
      {graphNodes.map((node) => (
        <GraphNode key={node.id} node={node} />
      ))}
      <Float speed={0.5} rotationIntensity={0.05} floatIntensity={0.1}>
        <group />
      </Float>
    </>
  );
}

export function DependencyGraph3D() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 1, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <GraphScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
