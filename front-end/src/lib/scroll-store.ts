// Plain object for scroll state — read by R3F useFrame without React re-renders
export const scrollStore = { progress: 0 };

// Smoothstep interpolation
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Lerp between two numbers
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Clamp
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
