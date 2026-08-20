"use client";

import { useMemo } from "react";
import { smoothstep } from "@/lib/scroll-store";

interface FinalCtaProps {
  progress: number;
}

export function FinalCta({ progress }: FinalCtaProps) {
  const opacity = useMemo(() => {
    return smoothstep(0.88, 0.95, progress);
  }, [progress]);

  if (opacity < 0.01) return null;

  return (
    <div
      className="final-cta"
      style={{ opacity }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <div className="final-cta-headline">
          Stop counting
          <br />
          vulnerable packages.
        </div>
      </div>
      <div style={{ marginBottom: "3rem" }}>
        <div className="final-cta-sub">
          Start understanding their impact.
        </div>
      </div>
      <div className="cta-buttons">
        <a href="#" className="cta-primary">
          Scan your repository
          <span style={{ fontSize: "1.1em" }}>→</span>
        </a>
        <a href="#" className="cta-secondary">
          Explore ChainTrace
          <span style={{ fontSize: "1.1em" }}>→</span>
        </a>
      </div>
    </div>
  );
}
