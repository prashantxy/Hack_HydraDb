"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Navigation } from "./navigation";
import { TypographyOverlay } from "./typography-overlay";
import { FinalCta } from "./final-cta";
import { scrollStore } from "@/lib/scroll-store";

// Lazy-load heavy scenes — defined OUTSIDE the component so they are stable
const AtmosphereBg = dynamic(
  () =>
    import("./atmosphere-bg").then((mod) => ({ default: mod.AtmosphereBg })),
  {
    ssr: false,
    loading: () => (
      <div className="atmosphere-bg" style={{ background: "#050508" }} />
    ),
  }
);

const GraphScene = dynamic(
  () =>
    import("./graph-scene").then((mod) => ({ default: mod.GraphScene })),
  {
    ssr: false,
    loading: () => <div className="graph-canvas-wrapper" />,
  }
);

export function CinematicPage() {
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const p = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    scrollStore.progress = p;
    setProgress(p);
  }, []);

  useEffect(() => {
    handleScroll();

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [handleScroll]);

  return (
    <>
      {/* Layer 0: Atmosphere background (image + water waves + clouds) */}
      <AtmosphereBg />

      {/* Layer 2: 3D graph scene (transparent background) */}
      <GraphScene />

      {/* Layer 10: Typography overlay */}
      <TypographyOverlay progress={progress} />

      {/* Layer 50: Navigation */}
      <Navigation progress={progress} />

      {/* Scroll spacer */}
      <div className="scroll-spacer" />

      {/* Final CTA */}
      <FinalCta progress={progress} />
    </>
  );
}
