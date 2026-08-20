"use client";

import { AsciiHero } from "./ascii-hero";
import { CountUp, PixelArrow, Reveal, Ticks } from "./primitives";

/* the readout mirrors GET /blast-radius — service, hops, severity */
const REACHED = [
  { name: "checkout-api", env: "production", hops: 2, sev: "CRITICAL" },
  { name: "billing-worker", env: "production", hops: 3, sev: "CRITICAL" },
  { name: "docs-site", env: "staging", hops: 3, sev: "MEDIUM" },
] as const;

export function Hero() {
  return (
    <div className="ct-hero" id="top">
      <Reveal className="ct-hero-copy">
        <div className="ct-hero-badge" style={{ ["--i" as string]: 0 }}>
          Built on <b>HydraDB</b> · OpenCypher over object storage
        </div>

        <h1 className="ct-h1" style={{ ["--i" as string]: 1 }}>
          A compromised package is a graph problem.
        </h1>

        <p className="ct-lede" style={{ ["--i" as string]: 2 }}>
          ChainTrace turns your npm and Python lockfiles into one dependency
          graph, then walks it backwards from any compromised version to the
          services that actually ship it — with hop counts, the attack path,
          and a risk score that weighs production first.
        </p>

        <div className="ct-btn-row" style={{ ["--i" as string]: 3 }}>
          <a href="#start" className="ct-btn">
            Scan a repo
            <PixelArrow />
          </a>
          <a href="/console/graph" className="ct-btn ct-btn-ghost">
            See the traversal
            <PixelArrow />
          </a>
        </div>

        <p
          className="ct-mono"
          style={{ ["--i" as string]: 4, color: "var(--fg-4)" }}
        >
          npm · bun · pip · poetry · pipenv — lockfile parsed, ranges resolved
        </p>
      </Reveal>

      <div className="ct-hero-visual">
        <AsciiHero />

        <div className="ct-hero-cards">
          <div className="ct-card" style={{ position: "relative" }}>
            <Ticks />

            <div className="ct-card-head">
              <span>Blast radius — live</span>
              <span style={{ color: "var(--fg-4)" }}>depth 5</span>
            </div>

            <div className="ct-card-body">
              <p
                className="ct-mono"
                style={{ color: "var(--fg-3)", marginBottom: "0.55rem" }}
              >
                from <span style={{ color: "var(--sig)" }}>npm:axios@1.7.2</span>
              </p>

              {REACHED.map((s) => (
                <div key={s.name} className="ct-row">
                  <span className="ct-row-name">
                    <i className="ct-dot" aria-hidden />
                    <span>{s.name}</span>
                  </span>
                  <span className="ct-hops">{s.hops} hops</span>
                  <span className={`ct-sev ct-sev-${s.sev}`}>{s.sev}</span>
                </div>
              ))}
            </div>

            <div className="ct-card-foot">
              <i className="ct-dot ct-pulse" aria-hidden />
              <span>
                risk <CountUp to={92} />/100 · 2 production services reached
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
