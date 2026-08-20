"use client";

import { AlertTriangle, ArrowDown, CheckCircle2 } from "lucide-react";

export function Problem() {
  return (
    <section id="product" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            The Problem
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            A vulnerable package is only the beginning.
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            Traditional scanners stop at the package level. They tell you something is
            vulnerable but not what it actually breaks.
          </p>
        </div>

        {/* Comparison */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Traditional */}
          <div className="glass rounded-xl p-8 border border-card-border/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-muted/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium">Traditional Scanner</p>
                <p className="text-xs text-muted">Package-level detection</p>
              </div>
            </div>
            <div className="bg-background/50 rounded-lg p-6 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-foreground">axios@1.7.2</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="severity-critical px-2 py-0.5 rounded text-xs font-medium">
                  CRITICAL
                </span>
              </div>
              <p className="text-xs text-muted mt-4">
                That&apos;s it. No context. No impact analysis.
              </p>
            </div>
          </div>

          {/* ChainTrace */}
          <div className="glass rounded-xl p-8 border border-accent/20 glow-accent">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">ChainTrace</p>
                <p className="text-xs text-accent">Blast-radius analysis</p>
              </div>
            </div>
            <div className="bg-background/50 rounded-lg p-6 font-mono text-sm space-y-1">
              <div className="text-foreground">axios@1.7.2</div>
              <ArrowDown className="w-3 h-3 text-muted my-0.5" />
              <div className="text-foreground">payment-api</div>
              <ArrowDown className="w-3 h-3 text-muted my-0.5" />
              <div className="text-muted">production</div>
              <ArrowDown className="w-3 h-3 text-muted my-0.5" />
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">90/100</span>
                <span className="severity-critical px-2 py-0.5 rounded text-xs font-medium">
                  CRITICAL
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
