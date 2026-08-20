"use client";

import { useEffect, useRef, useState } from "react";
import { createAsciiRenderer } from "landing-effects";

/*
 * The hero visual: hero-blast.png (a dependency graph rendered as
 * a luminance field) resolved into ASCII on a WebGL canvas. Digits
 * are the character set on purpose — a graph read out as data.
 *
 * The renderer's built-in palette is cool-toned, so the canvas is
 * hue-shifted in CSS to the signal colour. Cheaper than the
 * library's colorFn path, which falls back to Canvas2D.
 */

export function AsciiHero({ src = "/hero-blast.png" }: { src?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup: (() => void) | undefined;
    let raf = 0;

    try {
      cleanup = createAsciiRenderer({
        canvas,
        imageSrc: src,
        chars: " 0123456789",
        fontSize: 10,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        brightnessBoost: 2.6,
        posterize: 10,
        parallaxStrength: 14,
        scale: 1.05,
      });
      // next frame, so the canvas has something to fade in to
      raf = requestAnimationFrame(() => setLive(true));
    } catch {
      // no WebGL, no OffscreenCanvas — the still frame stands in
      return;
    }

    return () => {
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [src]);

  return (
    <>
      {!live && <div className="ct-ascii-still" aria-hidden />}
      <canvas
        ref={canvasRef}
        className={`ct-ascii ${live ? "is-live" : ""}`}
        style={{ filter: "hue-rotate(168deg) saturate(1.45) brightness(1.05)" }}
        aria-hidden
      />
      <div className="ct-scanline" aria-hidden />
    </>
  );
}
