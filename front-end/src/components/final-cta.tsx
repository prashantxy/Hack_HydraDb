"use client";

import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section
      id="scan"
      className="relative py-24 sm:py-32 overflow-hidden"
    >
      {/* Background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06)_0%,transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          Stop counting vulnerable packages.{" "}
          <span className="text-muted">Start understanding their impact.</span>
        </h2>

        <p className="text-muted max-w-xl mx-auto mb-10">
          ChainTrace gives you the full picture: which packages are vulnerable,
          which services are exposed, and how the compromise propagates.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="#"
            className="inline-flex items-center gap-2 bg-foreground text-background px-7 py-3.5 rounded-lg font-medium text-sm hover:bg-foreground/90 transition-colors"
          >
            Scan Your Repository
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#product"
            className="inline-flex items-center gap-2 glass px-7 py-3.5 rounded-lg font-medium text-sm text-foreground hover:bg-card transition-colors border border-card-border/50"
          >
            Explore the Graph
          </a>
        </div>

        {/* Quick stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          <div>
            <p className="text-2xl font-bold text-foreground">3</p>
            <p className="text-xs text-muted mt-1">Production services</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">27</p>
            <p className="text-xs text-muted mt-1">Dependencies tracked</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-critical">14</p>
            <p className="text-xs text-muted mt-1">Critical findings</p>
          </div>
        </div>
      </div>
    </section>
  );
}
