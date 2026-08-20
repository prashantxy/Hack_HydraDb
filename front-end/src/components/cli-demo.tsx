"use client";

import { useEffect, useState } from "react";

const terminalLines = [
  { text: "$ chaintrace scan --path ../backend --depth 5", delay: 0 },
  { text: "", delay: 400 },
  { text: "ChainTrace Scan", delay: 600, style: "bold" },
  { text: "", delay: 700 },
  { text: "Lockfile: bun", delay: 900 },
  { text: "Path:     ../backend/bun.lock", delay: 1000 },
  { text: "Dependencies found: 27", delay: 1100 },
  { text: "", delay: 1200 },
  { text: "Analyzing dependency risk...", delay: 1400 },
  { text: "", delay: 1500 },
  { text: "  axios@1.7.2 ... CRITICAL (90/100)", delay: 1800, style: "critical" },
  { text: "  form-data@4.0.6 ... CRITICAL (100/100)", delay: 2100, style: "critical" },
  { text: "  mime-types@2.1.35 ... CRITICAL (100/100)", delay: 2400, style: "critical" },
  { text: "  follow-redirects@1.15.6 ... HIGH (60/100)", delay: 2700, style: "high" },
  { text: "  semver@7.6.0 ... LOW (10/100)", delay: 3000, style: "low" },
  { text: "", delay: 3100 },
  { text: "══════════════════════════════════════════════", delay: 3200 },
  { text: "             ChainTrace Security Summary", delay: 3300, style: "bold" },
  { text: "══════════════════════════════════════════════", delay: 3400 },
  { text: "", delay: 3500 },
  { text: "Dependencies analyzed: 27/27", delay: 3600 },
  { text: "Critical: 14", delay: 3700, style: "critical" },
  { text: "High:     0", delay: 3750 },
  { text: "Medium:   0", delay: 3800 },
  { text: "Low:      13", delay: 3850, style: "low" },
  { text: "", delay: 3900 },
  { text: "Top risks:", delay: 4000, style: "bold" },
  { text: "", delay: 4050 },
  { text: "  CRITICAL form-data@4.0.6 — 100/100", delay: 4200, style: "critical" },
  { text: "", delay: 4300 },
  { text: "      ┌─ SERVICE IMPACT", delay: 4400 },
  { text: "      │ form-data@4.0.6", delay: 4450 },
  { text: "      │ affected services: 2", delay: 4500 },
  { text: "      │ production services: 2", delay: 4550 },
  { text: "      │", delay: 4600 },
  { text: "      │  ├─ checkout-service [production] (0 hops)", delay: 4700 },
  { text: "      │  │  ├─ Affected production service", delay: 4750 },
  { text: "      │  │  └─ Direct dependency", delay: 4800 },
  { text: "      │  │", delay: 4850 },
  { text: "      │  └─ payment-api [production] (1 hop)", delay: 4900 },
  { text: "      │     ├─ Affected production service", delay: 4950 },
  { text: "      │     └─ One-hop transitive dependency", delay: 5000 },
  { text: "      └────────────────────────", delay: 5050 },
  { text: "", delay: 5100 },
  { text: "✗ CRITICAL supply-chain risks detected.", delay: 5200, style: "critical-bold" },
];

function getLineColor(style?: string) {
  switch (style) {
    case "critical":
    case "critical-bold":
      return "text-critical";
    case "high":
      return "text-high";
    case "low":
      return "text-low";
    case "bold":
      return "text-foreground font-semibold";
    default:
      return "text-muted";
  }
}

export function CliDemo() {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    terminalLines.forEach((line, i) => {
      const timer = setTimeout(() => {
        setVisibleLines(i + 1);
      }, line.delay);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            CLI
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Security intelligence from your terminal.
          </h2>
          <p className="text-muted max-w-2xl mx-auto">
            Full supply-chain analysis, blast radius, and service impact — right in your terminal.
          </p>
        </div>

        {/* Terminal */}
        <div className="max-w-4xl mx-auto">
          <div className="terminal-window">
            <div className="terminal-titlebar">
              <div className="terminal-dot bg-[#ff5f57]" />
              <div className="terminal-dot bg-[#febc2e]" />
              <div className="terminal-dot bg-[#28c840]" />
              <span className="text-xs text-muted ml-3 font-mono">
                chaintrace — bash
              </span>
            </div>
            <div className="p-5 font-mono text-sm leading-relaxed max-h-[520px] overflow-y-auto">
              {terminalLines.slice(0, visibleLines).map((line, i) => (
                <div
                  key={i}
                  className={`${getLineColor(line.style)} min-h-[1.4em]`}
                >
                  {line.text || "\u00A0"}
                </div>
              ))}
              {visibleLines < terminalLines.length && (
                <span className="inline-block w-2 h-4 bg-foreground/70 cursor-blink" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
