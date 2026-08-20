"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Water Wave Shader ────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float waterBand = smoothstep(0.32, 0.44, uv.y) * (1.0 - smoothstep(0.56, 0.68, uv.y));
    float lowerMask = smoothstep(0.50, 0.65, uv.y);

    pos.y += sin(pos.x * 2.2 + uTime * 0.65) * 0.018 * waterBand;
    pos.y += sin(pos.x * 5.5 - uTime * 0.42) * 0.009 * waterBand;
    pos.y += sin(pos.x * 11.0 + uTime * 0.95) * 0.004 * waterBand;
    pos.x += cos(pos.y * 3.5 + uTime * 0.50) * 0.003 * waterBand;
    pos.y += sin(pos.x * 1.4 + uTime * 0.28) * 0.007 * lowerMask;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    float waterBand = smoothstep(0.32, 0.44, uv.y) * (1.0 - smoothstep(0.56, 0.68, uv.y));
    float lowerMask = smoothstep(0.50, 0.65, uv.y);

    // Water UV ripple
    uv.x += sin(uv.y * 28.0 + uTime * 0.38) * 0.006 * waterBand;
    uv.y += sin(uv.x * 20.0 + uTime * 0.55) * 0.004 * waterBand;

    // Fine shimmer
    float shimmer = sin(uv.x * 70.0 + uv.y * 50.0 + uTime * 2.2) * 0.0012;
    uv += shimmer * waterBand;

    // Lower-horizon cloud drift
    uv.x += sin(uTime * 0.18) * 0.003 * lowerMask;
    uv.y += cos(uTime * 0.12) * 0.001 * lowerMask;

    vec4 color = texture2D(uTexture, uv);

    // Surface sparkle
    float sparkle = sin(uv.x * 45.0 + uTime * 1.1) * 0.02 * waterBand;
    color.rgb += sparkle;

    // Vignette
    float vig = 1.0 - length((vUv - 0.5) * vec2(1.4, 1.1));
    vig = smoothstep(0.0, 0.65, vig);
    color.rgb *= mix(0.7, 1.0, vig);

    gl_FragColor = color;
  }
`;

// ── Background Plane with image texture ──────────────────────

function BackgroundPlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
    }),
    []
  );

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/assets/download.png", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      uniforms.uTexture.value = tex;
      setTexture(tex);
    });
  }, [uniforms]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (!texture) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, -5]}>
      <planeGeometry args={[22, 13, 80, 80]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Main Component ───────────────────────────────────────────

export function AtmosphereBg() {
  return (
    <div className="atmosphere-bg">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50, near: 0.5, far: 20 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#050508"]} />
        <ambientLight intensity={0.5} />
        <BackgroundPlane />
      </Canvas>
    </div>
  );
}
