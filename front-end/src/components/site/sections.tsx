"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BlastGraph } from "./blast-graph";
import { Glyph, type GlyphKind } from "./glyphs";
import { PixelWaves, PixelWordmark } from "./pixel-field";
import {
  CountUp,
  Frame,
  Hatch,
  PixelArrow,
  Reveal,
  Wordmark,
} from "./primitives";
import { Terminal, type TermLine } from "./terminal";

/* ══ stat strip ═══════════════════════════════════════════════
 * Four numbers that are all real limits of the system, not
 * marketing figures.
 */

export function Stats() {
  return (
    <div className="ct-stats">
      <Stat n={5} label="Hops per traversal — depth is capped, not unbounded" />
      <Stat n={4} label="Lockfile formats read: npm, pnpm, yarn, bun" />
      <Stat
        n={100}
        label="Risk scale per service — production weighted heaviest"
      />
      <Stat n={1} label="Pinned graph snapshot per query, on HydraDB" />
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="ct-stat">
      <div className="ct-stat-num">
        <CountUp to={n} />
      </div>
      <div className="ct-stat-label">{label}</div>
    </div>
  );
}

/* ══ problem ══════════════════════════════════════════════════
 * Three failures of the same model. The kicker names the thing the
 * scanner cannot see; the glyph draws it; the copy explains it.
 */

const PROBLEMS: {
  kick: string;
  kind: GlyphKind;
  title: string;
  body: string;
}[] = [
  {
    kick: "Count",
    kind: "flat",
    title: "A list is not an impact",
    body: "A scanner hands you a count of vulnerable packages. Nothing in that list tells you whether the bad version ships in checkout or sits in a test fixture nobody runs.",
  },
  {
    kick: "Depth",
    kind: "depth",
    title: "The reach is transitive",
    body: "The package that breaks you is three hops down someone else's tree, pulled in by a semver range you never wrote and cannot see from your own manifest.",
  },
  {
    kick: "Ownership",
    kind: "fan",
    title: "Services carry the risk",
    body: "Risk lands on the service that ships the code, and on the team that owns it. Package-level reports cannot tell you who gets paged tonight.",
  },
];

export function Problem() {
  return (
    <>
      <section className="ct-sec ct-head" >
        <Reveal className="ct-head-grid">
          <div style={{ ["--i" as string]: 0 }}>
            <p className="ct-eyebrow">The problem</p>
            <h2 className="ct-h2" style={{ marginTop: "1.1rem" }}>
              Supply chain tools count packages. Attacks travel edges.
            </h2>
          </div>

          <dl className="ct-head-meta" style={{ ["--i" as string]: 1 }}>
            <div>
              <dt>Failure modes</dt>
              <dd>03</dd>
            </div>
            <div>
              <dt>Shared cause</dt>
              <dd>the graph is thrown away</dd>
            </div>
          </dl>
        </Reveal>
      </section>

      <div className="ct-sec" style={{ paddingInline: 0 }}>
        <Reveal className="ct-tri ct-tri-tall" as="div">
          {PROBLEMS.map((p, i) => (
            <div key={p.title} style={{ ["--i" as string]: i }}>
              <p className="ct-kick">
                <span>{String(i + 1).padStart(2, "0")}</span>
                {p.kick}
              </p>

              <div className="ct-prob-glyph">
                <Glyph kind={p.kind} />
              </div>

              <h3 className="ct-h3">{p.title}</h3>
              <p className="ct-card-note">{p.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </>
  );
}

/* ══ solution ═════════════════════════════════════════════════ */

const CHECK_OUTPUT: TermLine[] = [
  { kind: "cmd", content: "chaintrace check axios@1.7.2 --depth 5" },
  { kind: "out", content: <>{"  "}resolved  npm:axios@1.7.2</>, wait: 420 },
  {
    kind: "out",
    content: (
      <>
        {"  "}traversed <b>1,284</b> versions · <b>3,910</b> DEPENDS_ON edges
      </>
    ),
    wait: 260,
  },
  { kind: "out", content: " ", wait: 120 },
  {
    kind: "out",
    content: (
      <>
        {"  "}
        <i>✗ CRITICAL</i> checkout-api{"      "}risk <b>92</b>/100 · 2 hops
      </>
    ),
    wait: 200,
  },
  {
    kind: "out",
    content: (
      <>
        {"  "}
        <i>✗ CRITICAL</i> billing-worker{"    "}risk <b>88</b>/100 · 3 hops
      </>
    ),
    wait: 160,
  },
  {
    kind: "out",
    content: (
      <>
        {"  "}⚠ MEDIUM{"   "}docs-site{"         "}risk <b>44</b>/100 · 3 hops
      </>
    ),
    wait: 160,
  },
  { kind: "out", content: " ", wait: 120 },
  {
    kind: "out",
    content: (
      <>
        {"  "}reasons{"   "}production service · direct dependency
      </>
    ),
    wait: 220,
  },
  {
    kind: "out",
    content: (
      <>
        {"  "}path{"      "}checkout-api → pay-core@7.4.0 → axios@1.7.2
      </>
    ),
    wait: 180,
  },
];

export function Solution() {
  return (
    <section className="ct-sec ct-sec-pad" id="graph">
      <div className="ct-split">
        <Reveal>
          <p className="ct-eyebrow" style={{ ["--i" as string]: 0 }}>
            The approach
          </p>
          <h2
            className="ct-h2"
            style={{ ["--i" as string]: 1, margin: "1rem 0 1.1rem" }}
          >
            Store the edges.{" "}
            <span className="ct-dim">Then ask backwards.</span>
          </h2>
          <p className="ct-lede" style={{ ["--i" as string]: 2 }}>
            Every lockfile becomes vertices and edges in HydraDB, with your
            services attached to the versions they ship. Ranges are resolved to
            concrete versions on the way in, so the graph holds what you
            actually install.
          </p>

          <pre
            className="ct-mono ct-schema"
            style={{ ["--i" as string]: 3 }}
          >{`(:Package)-[:HAS_VERSION]->(:Version)
(:Version)-[:DEPENDS_ON]->(:Version)
(:Service)-[:DEPENDS_ON_VERSION]->(:Version)`}</pre>

          <ul className="ct-list" style={{ ["--i" as string]: 4 }}>
            <li>Blast radius: which services a bad version reaches, and in how many hops</li>
            <li>Attack path: the exact chain from service to compromised version</li>
            <li>Risk: scored per service, production weighted heaviest</li>
            <li>One pinned snapshot per query — the answer never straddles a write</li>
          </ul>
        </Reveal>

        <Reveal>
          <div style={{ ["--i" as string]: 1 }}>
            <Terminal title="chaintrace — cli" lines={CHECK_OUTPUT} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══ the stack: sticky rail + panels ══════════════════════════ */

type Panel = {
  id: string;
  tab: string;
  title: ReactNode;
  body: string;
  chips: string[];
  visual: ReactNode;
  /* the blast graph is the page's signature — it gets the full
   * panel width instead of sharing the row with the copy */
  wide?: boolean;
};

function SpecCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, ReactNode][];
}) {
  return (
    <Frame>
      <div className="ct-card-head">{title}</div>
      <dl className="ct-spec">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Frame>
  );
}

function PathChain() {
  const hops = [
    { label: "checkout-api", note: "service · production", hot: true },
    { label: "pay-core@7.4.0", note: "runtime · ^7.4.0" },
    { label: "http-client@2.1.4", note: "runtime · ^2.1.0" },
    { label: "axios@1.7.2", note: "compromised", hot: true },
  ];

  return (
    <Frame>
      <div className="ct-card-head">
        <span>Attack path — 3 hops</span>
        <span style={{ color: "var(--fg-4)" }}>1 of 4</span>
      </div>

      <div style={{ padding: "1.1rem" }}>
        {hops.map((h, i) => (
          <div key={h.label}>
            <div
              className="ct-mono"
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.7rem",
                color: h.hot ? "var(--fg)" : "var(--fg-2)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  flex: "none",
                  background: h.hot ? "var(--sig)" : "var(--fg-4)",
                  transform: "translateY(-1px)",
                }}
                aria-hidden
              />
              <span>{h.label}</span>
              <span style={{ marginLeft: "auto", color: "var(--fg-4)" }}>
                {h.note}
              </span>
            </div>

            {i < hops.length - 1 && (
              <div
                aria-hidden
                style={{
                  marginLeft: 3,
                  width: 1,
                  height: 26,
                  background:
                    "linear-gradient(to bottom, var(--line-2), var(--line))",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function RiskCard() {
  const reasons: [string, number][] = [
    ["Affected production service", 60],
    ["One-hop transitive dependency", 20],
    ["Reached within 3 hops", 10],
    ["Team owns 4 downstream services", 2],
  ];

  return (
    <Frame>
      <div className="ct-card-head">
        <span>Risk — billing-worker</span>
        <span style={{ color: "var(--crit)" }}>CRITICAL</span>
      </div>

      <div style={{ padding: "1.1rem" }}>
        <div
          className="ct-stat-num"
          style={{ fontSize: "3rem", marginBottom: "0.9rem" }}
        >
          <CountUp to={92} />
          <span style={{ color: "var(--fg-4)", fontSize: "1.25rem" }}>/100</span>
        </div>

        {reasons.map(([label, pts]) => (
          <div key={label} className="ct-row">
            <span className="ct-row-name">
              <span>{label}</span>
            </span>
            <span className="ct-hops">+{pts}</span>
            <span
              aria-hidden
              style={{
                width: 54,
                height: 4,
                background: "rgba(255,255,255,.08)",
                display: "block",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${pts}%`,
                  background: "var(--sig)",
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const PANELS: Panel[] = [
  {
    id: "scan",
    tab: "Lockfile scan",
    title: (
      <>
        Point it at a repo.{" "}
        <span className="ct-dim">It finds the lockfile.</span>
      </>
    ),
    body: "The CLI detects bun.lock, package-lock.json, pnpm-lock.yaml or yarn.lock, resolves every semver range to the version npm would actually install, and ingests the result. Package coordinates leave your machine; source files never do.",
    chips: ["4 lockfile formats", "Range resolution", "Local parse"],
    visual: (
      <Terminal
        title="chaintrace — scan"
        lines={[
          { kind: "cmd", content: "chaintrace scan --path ./services/checkout" },
          { kind: "out", content: <>{"  "}detected  pnpm-lock.yaml</>, wait: 400 },
          {
            kind: "out",
            content: (
              <>
                {"  "}parsed{"    "}
                <b>612</b> direct · <b>1,284</b> transitive
              </>
            ),
            wait: 240,
          },
          {
            kind: "out",
            content: (
              <>
                {"  "}resolved{"  "}ranges → concrete versions
              </>
            ),
            wait: 220,
          },
          {
            kind: "out",
            content: (
              <>
                {"  "}ingested{"  "}
                <i>1,896</i> vertices · <i>3,910</i> edges
              </>
            ),
            wait: 260,
          },
          { kind: "out", content: " ", wait: 120 },
          {
            kind: "out",
            content: (
              <>
                {"  "}high risk <b>2</b> · medium <b>7</b> · low <b>1,275</b>
              </>
            ),
            wait: 200,
          },
        ]}
      />
    ),
  },
  {
    id: "graph",
    tab: "Dependency graph",
    title: (
      <>
        The tree, stored as a graph.{" "}
        <span className="ct-dim">Not a flattened list.</span>
      </>
    ),
    body: "Packages, versions and DEPENDS_ON edges live in HydraDB with the dependency type and the range that pulled them in. Traversal runs level by level, so you can ask for depth 2 and get depth 2 — not a query that walks your whole graph.",
    chips: ["OpenCypher", "runtime · peer · optional", "Depth 1–5"],
    visual: (
      <SpecCard
        title="GET /packages/axios/graph?depth=2"
        rows={[
          ["package", "axios"],
          ["depth", <em key="d">2</em>],
          ["nodes", "1,896 — Version vertices with hop depth"],
          ["edges", "3,910 — DEPENDS_ON, typed and ranged"],
          ["model", "Package → HAS_VERSION → Version"],
          ["read", <em key="r">one pinned snapshot</em>],
        ]}
      />
    ),
  },
  {
    id: "blast",
    tab: "Blast radius",
    title: (
      <>
        One bad version.{" "}
        <span className="ct-dim">Every service it reaches.</span>
      </>
    ),
    body: "Give it a version key and it walks DEPENDS_ON in reverse, collecting the services that ship it and the number of hops each one sits at. That hop count is the difference between a package you upgrade this quarter and one you page someone for tonight.",
    chips: ["Reverse traversal", "Hop distance", "Per-service"],
    wide: true,
    visual: <BlastGraph />,
  },
  {
    id: "path",
    tab: "Attack path",
    title: (
      <>
        The chain, not the verdict.{" "}
        <span className="ct-dim">Every link named.</span>
      </>
    ),
    body: "A score you cannot audit is a score nobody acts on. Attack paths return the actual chain — service, then each version in between, then the compromised one — with the range that pulled each link in, so you can see exactly where to cut.",
    chips: ["Full chain", "Ranges shown", "Auditable"],
    visual: <PathChain />,
  },
  {
    id: "risk",
    tab: "Risk score",
    title: (
      <>
        Scored where it lands.{" "}
        <span className="ct-dim">On the service.</span>
      </>
    ),
    body: "Production counts for 60 points, staging for 30. A direct dependency adds 30, one hop adds 20, three or fewer adds 10. Every score arrives with the reasons that produced it, so the ranking is arguable — which is the point.",
    chips: ["0–100", "Reasons attached", "Environment aware"],
    visual: <RiskCard />,
  },
];

export function Stack() {
  const [active, setActive] = useState(PANELS[0].id);
  const panelRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    for (const el of Object.values(panelRefs.current)) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="ct-sec" id="stack" style={{ paddingInline: 0 }}>
      <div className="ct-stack">
        <div className="ct-stack-rail">
          <div className="ct-stack-rail-in">
            <p
              className="ct-eyebrow ct-eyebrow-mute"
              style={{ marginBottom: "0.8rem", paddingLeft: "0.1rem" }}
            >
              The stack
            </p>

            {PANELS.map((p, i) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className={`ct-tab ${active === p.id ? "is-active" : ""}`}
              >
                {p.tab}
                <span className="ct-tab-idx">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </a>
            ))}
          </div>
        </div>

        <div>
          {PANELS.map((p) => (
            <article
              key={p.id}
              id={p.id}
              ref={(el) => {
                panelRefs.current[p.id] = el;
              }}
              className={`ct-panel ${p.wide ? "ct-panel-wide" : ""}`}
            >
              <Reveal className="ct-panel-copy">
                <h2 className="ct-h2" style={{ ["--i" as string]: 0 }}>
                  {p.title}
                </h2>
                <p className="ct-lede" style={{ ["--i" as string]: 1 }}>
                  {p.body}
                </p>
                <div className="ct-chips" style={{ ["--i" as string]: 2 }}>
                  {p.chips.map((c) => (
                    <span key={c} className="ct-chip">
                      {c}
                    </span>
                  ))}
                </div>
              </Reveal>

              <div>{p.visual}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══ audience ═════════════════════════════════════════════════ */

const AUDIENCE = [
  {
    tag: "SECURITY",
    title: "Triage by reach",
    body: "Sort an advisory feed by which services it actually touches, and close the ones that reach nothing without a meeting about it.",
  },
  {
    tag: "PLATFORM",
    title: "Know who to page",
    body: "Every affected service carries its repo, team and environment, so the list of people who need to act writes itself.",
  },
  {
    tag: "ENGINEERING",
    title: "Upgrade what matters",
    body: "Hop distance and dependency type tell you which upgrade removes real exposure and which one just moves a number.",
  },
];

export function Audience() {
  return (
    <>
      <section className="ct-sec ct-head" >
        <Reveal className="ct-head-grid">
          <div style={{ ["--i" as string]: 0 }}>
            <p className="ct-eyebrow">Who it&apos;s for</p>
            <h2 className="ct-h2" style={{ marginTop: "1.1rem" }}>
              Built for the people who get paged.
            </h2>
          </div>

          <dl className="ct-head-meta" style={{ ["--i" as string]: 1 }}>
            <div>
              <dt>Roles</dt>
              <dd>03</dd>
            </div>
            <div>
              <dt>Shared question</dt>
              <dd>what does this actually reach?</dd>
            </div>
          </dl>
        </Reveal>
      </section>

      <div className="ct-sec" style={{ paddingInline: 0 }}>
        <Reveal className="ct-tri ct-tri-aud" as="div">
          {AUDIENCE.map((a, i) => (
            <div key={a.tag} style={{ ["--i" as string]: i }}>
              <p className="ct-aud-tag">{a.tag}</p>
              <h3 className="ct-h3">{a.title}</h3>
              <p className="ct-card-note">{a.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </>
  );
}

/* ══ how it works ═════════════════════════════════════════════ */

const STEPS = [
  {
    title: "Scan the repo",
    body: "chaintrace scan reads the lockfile, resolves ranges, and writes packages, versions and DEPENDS_ON edges into the graph.",
    cmd: "chaintrace scan",
  },
  {
    title: "Register the services",
    body: "A service names its repo, team and environment, and the versions it ships. This is what turns a package graph into an impact graph.",
    cmd: "POST /services",
  },
  {
    title: "Ask backwards",
    body: "Hand any version key to blast radius, attack path or risk, and get the services, the chains, and the scores with their reasons.",
    cmd: "GET /blast-radius",
  },
];

export function How() {
  return (
    <>
      <section className="ct-sec ct-head" id="how" >
        <Reveal className="ct-head-grid">
          <div style={{ ["--i" as string]: 0 }}>
            <p className="ct-eyebrow">How it works</p>
            <h2 className="ct-h2" style={{ marginTop: "1.1rem" }}>
              Three steps, in order.
            </h2>
          </div>

          <dl className="ct-head-meta" style={{ ["--i" as string]: 1 }}>
            <div>
              <dt>Setup</dt>
              <dd>one command</dd>
            </div>
            <div>
              <dt>Then</dt>
              <dd>every version is queryable</dd>
            </div>
          </dl>
        </Reveal>
      </section>

      <div className="ct-sec" style={{ paddingInline: 0 }}>
        <Reveal className="ct-steps" as="div">
          {STEPS.map((s, i) => (
            <div key={s.title} className="ct-step" style={{ ["--i" as string]: i }}>
              {/* the rail runs across all three columns as one line */}
              <div className="ct-step-rail" data-first={i === 0} data-last={i === 2}>
                <i className="ct-step-node" aria-hidden />
              </div>

              <span className="ct-step-n">
                {String(i + 1).padStart(2, "0")} / 03
              </span>
              <h3 className="ct-h3">{s.title}</h3>
              <p className="ct-card-note">{s.body}</p>
              <code className="ct-mono ct-step-cmd">{s.cmd}</code>
            </div>
          ))}
        </Reveal>
      </div>
    </>
  );
}

/* ══ faq ══════════════════════════════════════════════════════ */

const FAQ: [string, ReactNode][] = [
  [
    "How is this different from the scanner I already run?",
    "A scanner tells you a vulnerable version is present. ChainTrace tells you which of your services ship it, how many hops away it sits, and what the chain looks like. It answers impact, not presence — and it is meant to sit next to your scanner, taking its findings as input.",
  ],
  [
    "Which lockfiles does it read?",
    "package-lock.json, pnpm-lock.yaml, yarn.lock and bun.lock (including bun.lockb). The CLI detects the format from the project directory, so there is nothing to configure.",
  ],
  [
    "How is the risk score calculated?",
    "Per affected service, out of 100. A production service adds 60, staging 30, anything else 10. A direct dependency adds 30, one hop 20, and three hops or fewer 10. Every score returns the list of reasons that produced it.",
  ],
  [
    "Why a graph database?",
    "Because the questions are all traversals. Reaching backwards from a version to the services that depend on it, at bounded depth, is a graph walk — not a join. HydraDB keeps the graph durable in object storage and reads every query from one pinned snapshot, so a traversal never straddles a write.",
  ],
  [
    "How deep does traversal go?",
    "Up to five hops per query, and the depth is a parameter. The cap is deliberate: an unbounded walk across a real npm graph is not a query anyone should be able to trigger by accident.",
  ],
  [
    "Does my source code leave my machine?",
    "No. The CLI parses the lockfile locally and sends package coordinates — name, version, range — to the ingest API. It does not read or upload source files.",
  ],
];

export function Faq() {
  return (
    <section className="ct-sec ct-sec-pad" id="faq">
      <div className="ct-split">
        <Reveal>
          <p className="ct-eyebrow" style={{ ["--i" as string]: 0 }}>
            Questions
          </p>
          <h2 className="ct-h2" style={{ ["--i" as string]: 1, marginTop: "1rem" }}>
            The short answers.
          </h2>
        </Reveal>

        <div className="ct-faq">
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}</summary>
              <p className="ct-faq-a">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══ closing ══════════════════════════════════════════════════
 * The last screen is the dot matrix at full strength: a halftone
 * field running behind the call, then the wordmark punched into a
 * grid across the whole footer.
 */

export function Closing() {
  return (
    <>
      <section className="ct-closing" id="start">
        <PixelWaves />

        <Reveal className="ct-closing-card">
          <p className="ct-eyebrow" style={{ ["--i" as string]: 0 }}>
            Get started
          </p>

          <h2 className="ct-h2" style={{ ["--i" as string]: 1 }}>
            Stop counting vulnerable packages.
          </h2>
          <p className="ct-h2 ct-dim" style={{ ["--i" as string]: 2 }}>
            Start tracing what they reach.
          </p>

          <div className="ct-btn-row" style={{ ["--i" as string]: 3 }}>
            <a href="#" className="ct-btn">
              Scan a repo
              <PixelArrow />
            </a>
            <a href="#stack" className="ct-btn ct-btn-ghost">
              Read the API
              <PixelArrow />
            </a>
          </div>

          <p
            className="ct-mono"
            style={{ ["--i" as string]: 4, color: "var(--fg-4)" }}
          >
            npx chaintrace scan
          </p>
        </Reveal>
      </section>

      <Hatch />

      <footer>
        <div className="ct-foot">
          <div>
            <div
              style={{ color: "var(--fg)", width: 132, marginBottom: "1rem" }}
            >
              <Wordmark />
            </div>
            <p className="ct-foot-note">
              Dependency blast radius for npm, on a graph that lives in object
              storage.
            </p>
          </div>

          <div>
            <h4>Product</h4>
            <ul>
              <li>
                <a href="#stack">The stack</a>
              </li>
              <li>
                <a href="#blast">Blast radius</a>
              </li>
              <li>
                <a href="#path">Attack path</a>
              </li>
              <li>
                <a href="#risk">Risk score</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>API</h4>
            <ul>
              <li>
                <a href="#graph">/packages/:name/graph</a>
              </li>
              <li>
                <a href="#blast">/blast-radius</a>
              </li>
              <li>
                <a href="#path">/attack-path</a>
              </li>
              <li>
                <a href="#risk">/risk</a>
              </li>
            </ul>
          </div>

          <div>
            <h4>Built on</h4>
            <ul>
              <li>
                <a href="https://github.com/hydra-db/hydradb">HydraDB</a>
              </li>
              <li>OpenCypher</li>
              <li>Bun · TypeScript</li>
              <li>npm registry</li>
            </ul>
          </div>
        </div>

        <div className="ct-foot-bar">
          <span>© 2026 ChainTrace</span>
          <span>Graph reads pinned per snapshot · depth capped at 5</span>
        </div>

        <PixelWordmark />
      </footer>
    </>
  );
}
