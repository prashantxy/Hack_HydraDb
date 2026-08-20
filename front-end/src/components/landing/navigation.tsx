"use client";

import { useMemo } from "react";
import { smoothstep } from "@/lib/scroll-store";

interface NavigationProps {
  progress: number;
}

export function Navigation({ progress }: NavigationProps) {
  const bgOpacity = useMemo(() => {
    // Stronger glass effect as user scrolls past hero
    return smoothstep(0.03, 0.12, progress);
  }, [progress]);

  return (
    <nav
      className="nav-glass"
      style={{
        background: `rgba(8, 8, 14, ${0.25 + bgOpacity * 0.3})`,
      }}
    >
      {/* Left: Logo */}
      <div className="nav-glass-left">
        <div className="nav-logo">CHAINTRACE</div>
        <div className="nav-tagline">Supply Chain Security</div>
      </div>

      {/* Right: Links */}
      <div className="nav-glass-right">
        <a href="#product" className="nav-glass-link">Product</a>
        <a href="#graph" className="nav-glass-link">Graph</a>
        <a href="#github" className="nav-glass-link">GitHub</a>
      </div>
    </nav>
  );
}
