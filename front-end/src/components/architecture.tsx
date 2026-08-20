"use client";

import {
  FolderGit2,
  FileSearch,
  Download,
  Database,
  GitBranch,
  Cpu,
  Target,
  Eye,
} from "lucide-react";

const pipeline = [
  { label: "Repository", icon: FolderGit2 },
  { label: "Lockfile Scanner", icon: FileSearch },
  { label: "Package Ingestion", icon: Download },
  { label: "HydraDB Graph", icon: Database },
  { label: "Dependency Traversal", icon: GitBranch },
  { label: "Risk Engine", icon: Cpu },
  { label: "Blast Radius", icon: Target },
  { label: "3D Visualization", icon: Eye },
];

export function Architecture() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            Architecture
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Built around the dependency graph.
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            Every layer is designed around graph relationships, not isolated package lookups.
          </p>
        </div>

        {/* Pipeline */}
        <div className="max-w-4xl mx-auto">
          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-center justify-between gap-2">
            {pipeline.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === pipeline.length - 1;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-11 h-11 rounded-xl glass border border-card-border/50 flex items-center justify-center hover:border-accent/30 transition-colors">
                      <Icon className="w-4.5 h-4.5 text-accent" />
                    </div>
                    <span className="text-[11px] text-muted text-center leading-tight max-w-[72px]">
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className="w-6 h-px bg-card-border mx-1 mt-[-20px]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: vertical */}
          <div className="md:hidden flex flex-col items-center gap-4">
            {pipeline.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === pipeline.length - 1;
              return (
                <div key={step.label} className="flex flex-col items-center">
                  <div className="flex items-center gap-3 glass border border-card-border/50 rounded-xl px-4 py-3 w-full max-w-xs hover:border-accent/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-sm text-foreground">{step.label}</span>
                  </div>
                  {!isLast && (
                    <div className="w-px h-4 bg-card-border" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
