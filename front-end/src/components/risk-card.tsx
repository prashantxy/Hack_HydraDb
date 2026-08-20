"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowDownRight,
  Server,
  GitBranch,
} from "lucide-react";

const severityConfig = {
  CRITICAL: {
    color: "text-critical",
    bg: "bg-critical/10",
    border: "border-critical/20",
    glow: "glow-critical",
  },
  HIGH: {
    color: "text-high",
    bg: "bg-high/10",
    border: "border-high/20",
    glow: "",
  },
  MEDIUM: {
    color: "text-medium",
    bg: "bg-medium/10",
    border: "border-medium/20",
    glow: "",
  },
  LOW: {
    color: "text-low",
    bg: "bg-low/10",
    border: "border-low/20",
    glow: "",
  },
};

export function RiskCard() {
  const severity = "CRITICAL";
  const config = severityConfig[severity];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            Risk Intelligence
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            From vulnerability to impact.
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            ChainTrace doesn&apos;t just flag packages. It calculates production impact,
            service exposure, and attack paths.
          </p>
        </div>

        {/* Risk finding card */}
        <div className="max-w-3xl mx-auto">
          <div
            className={`glass rounded-2xl overflow-hidden border ${config.border} ${config.glow}`}
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-card-border/50">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className={`w-5 h-5 ${config.color}`} />
                    <h3 className="text-lg font-mono font-semibold">
                      form-data@4.0.6
                    </h3>
                  </div>
                  <p className="text-sm text-muted">
                    Transitive dependency of axios@1.7.2
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-3xl font-bold font-mono">100</p>
                    <p className="text-xs text-muted">/ 100</p>
                  </div>
                  <span
                    className={`${config.bg} ${config.color} ${config.border} border px-3 py-1 rounded-full text-xs font-semibold`}
                  >
                    {severity}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-card-border/50">
              <div className="p-4 sm:p-6 border-r border-card-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-3.5 h-3.5 text-muted" />
                  <p className="text-xs text-muted">Affected services</p>
                </div>
                <p className="text-2xl font-bold">2</p>
              </div>
              <div className="p-4 sm:p-6 border-r border-card-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5 text-muted" />
                  <p className="text-xs text-muted">Production</p>
                </div>
                <p className="text-2xl font-bold">2</p>
              </div>
              <div className="p-4 sm:p-6 border-r border-card-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="w-3.5 h-3.5 text-muted" />
                  <p className="text-xs text-muted">Max depth</p>
                </div>
                <p className="text-2xl font-bold">3</p>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-muted" />
                  <p className="text-xs text-muted">Attack paths</p>
                </div>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>

            {/* Blast radius */}
            <div className="p-6 sm:p-8">
              <p className="text-xs uppercase tracking-widest text-muted mb-4">
                Blast Radius
              </p>
              <div className="space-y-3">
                {/* Service 1 */}
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <span className="severity-critical w-2 h-2 rounded-full" />
                    <div>
                      <p className="text-sm font-medium">checkout-service</p>
                      <p className="text-xs text-muted">production</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted font-mono">0 hops</span>
                    <span className="severity-critical px-2 py-0.5 rounded text-xs font-medium">
                      Direct
                    </span>
                  </div>
                </div>

                {/* Service 2 */}
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <span className="severity-high w-2 h-2 rounded-full" />
                    <div>
                      <p className="text-sm font-medium">payment-api</p>
                      <p className="text-xs text-muted">production</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted font-mono">1 hop</span>
                    <span className="severity-high px-2 py-0.5 rounded text-xs font-medium">
                      Transitive
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk reasons */}
              <div className="mt-6 pt-6 border-t border-card-border/50">
                <p className="text-xs uppercase tracking-widest text-muted mb-3">
                  Risk Factors
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Affected production service",
                    "Direct dependency",
                    "One-hop transitive dependency",
                  ].map((reason) => (
                    <span
                      key={reason}
                      className="inline-flex items-center gap-1.5 text-xs text-muted bg-background/50 px-3 py-1.5 rounded-full border border-card-border/50"
                    >
                      <CheckCircle2 className="w-3 h-3 text-low" />
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
