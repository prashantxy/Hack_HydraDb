"use client";

import { FileSearch, GitBranch, Route, Target } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Scan",
    description: "ChainTrace reads your lockfile and extracts every dependency.",
    icon: FileSearch,
    details: ["bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
  },
  {
    num: "02",
    title: "Build the graph",
    description:
      "Dependencies are ingested and connected inside the HydraDB graph database.",
    icon: GitBranch,
    details: ["Package nodes", "Version nodes", "Dependency edges", "Service links"],
  },
  {
    num: "03",
    title: "Traverse",
    description:
      "ChainTrace follows dependency relationships across multiple hops to find every exposed path.",
    icon: Route,
    details: ["Direct deps", "Transitive deps", "BFS traversal", "Hop counting"],
  },
  {
    num: "04",
    title: "Calculate blast radius",
    description:
      "Identify which services are affected and which production environments are at risk.",
    icon: Target,
    details: ["Service mapping", "Production impact", "Risk scoring", "Attack paths"],
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Scan. Traverse. Understand.
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            From lockfile to production blast radius in four steps.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {/* Connecting line (desktop) */}
          <div className="absolute top-12 left-[12.5%] right-[12.5%] h-px bg-card-border hidden md:block" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="relative">
                {/* Step number circle */}
                <div className="relative z-10 w-12 h-12 rounded-full glass border border-card-border flex items-center justify-center mx-auto mb-6">
                  <Icon className="w-5 h-5 text-accent" />
                </div>

                {/* Content */}
                <div className="text-center">
                  <p className="text-xs text-accent font-mono font-semibold mb-1">
                    {step.num}
                  </p>
                  <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed mb-4">
                    {step.description}
                  </p>

                  {/* Details */}
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {step.details.map((detail) => (
                      <span
                        key={detail}
                        className="text-[10px] font-mono text-muted bg-background/50 px-2 py-1 rounded border border-card-border/50"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
