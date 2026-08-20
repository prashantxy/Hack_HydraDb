"use client";

import { ArrowRight, Code } from "lucide-react";
import dynamic from "next/dynamic";

const DependencyGraph3D = dynamic(
  () =>
    import("./dependency-graph").then((mod) => mod.DependencyGraph3D),
  { ssr: false }
);

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)]" />

      {/* 3D Graph backdrop */}
      <div className="absolute right-0 top-0 w-1/2 h-full opacity-60 hidden lg:block">
        <DependencyGraph3D />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-20 w-full">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-low animate-pulse" />
            <span className="text-xs text-muted font-medium">
              Supply-chain security platform
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Know the blast radius{" "}
            <span className="text-muted">before the attack does.</span>
          </h1>

          {/* Subtext */}
          <p className="text-lg text-muted leading-relaxed mb-10 max-w-xl">
            ChainTrace maps vulnerable dependencies to the production services
            they can actually affect. Not just another vulnerability scanner.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <a
              href="#scan"
              className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg font-medium text-sm hover:bg-foreground/90 transition-colors"
            >
              Scan a Repository
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 glass px-6 py-3 rounded-lg font-medium text-sm text-foreground hover:bg-card transition-colors"
            >
              <Code className="w-4 h-4" />
              View on GitHub
            </a>
          </div>

          {/* Terminal command */}
          <div className="inline-flex items-center gap-3 glass rounded-lg px-4 py-2.5">
            <span className="text-accent text-sm font-mono">$</span>
            <code className="text-sm font-mono text-muted">
              chaintrace scan --path ./backend --depth 5
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
