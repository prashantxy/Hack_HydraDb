"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  API,
  CI_EXAMPLE,
  CLI_COMMANDS,
  CLI_ENV,
  CONSOLE_VIEWS,
  EDGES,
  EXIT_CODES,
  GRAPH_MODEL,
  HTTP_ERRORS,
  LOCKFILES,
  RISK_BANDS,
  RISK_ROLLUP_RULES,
  RISK_SERVICE_RULES,
  VERTICES,
  type Endpoint,
  type Param,
} from "@/lib/docs-data";
import { PixelArrow, Wordmark } from "@/components/site/primitives";

/*
 * The reference. One long page with a sticky contents rail, because
 * a reference is something you search and scan, not something you
 * click through — Cmd+F should find every endpoint on one screen.
 */

const SECTIONS: { id: string; label: string; children?: [string, string][] }[] =
  [
    { id: "overview", label: "Overview" },
    { id: "quickstart", label: "Quick start" },
    { id: "model", label: "Graph model" },
    {
      id: "api",
      label: "HTTP API",
      children: API.map((g) => [g.id, g.title] as [string, string]),
    },
    { id: "risk", label: "Risk scoring" },
    { id: "cli", label: "CLI" },
    { id: "console", label: "Console" },
    { id: "errors", label: "Errors" },
  ];

export function DocsPage() {
  const [active, setActive] = useState("overview");

  /* Scroll-spy. Intersection alone loses the highlight once a heading
   * has scrolled fully past, so this picks the last heading above the
   * reading line instead — which is what you actually want to see
   * marked while you read the section under it. */
  useEffect(() => {
    const ids = SECTIONS.flatMap((s) => [
      s.id,
      ...(s.children ?? []).map(([id]) => id),
    ]);

    let raf = 0;

    const pick = () => {
      raf = 0;
      const line = 120;
      let current = ids[0];

      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
      }

      /* at the very bottom the last section wins, even if its heading
       * never crosses the line */
      if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 8) {
        current = ids[ids.length - 1];
      }

      setActive(current);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };

    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="ct dx">
      <header className="dx-top">
        <Link href="/" className="dx-brand" aria-label="ChainTrace home">
          <Wordmark />
        </Link>
        <span className="dx-top-sep" aria-hidden />
        <span className="dx-top-title">Docs</span>

        <nav className="dx-top-links">
          <Link href="/console">Console</Link>
          <Link href="/">Landing</Link>
        </nav>
      </header>

      <div className="dx-body">
        <nav className="dx-toc" aria-label="Contents">
          <div className="dx-toc-in">
            {SECTIONS.map((s) => (
              <div key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={`dx-toc-link ${active === s.id ? "is-active" : ""}`}
                >
                  {s.label}
                </a>
                {s.children && (
                  <div className="dx-toc-sub">
                    {s.children.map(([id, label]) => (
                      <a
                        key={id}
                        href={`#${id}`}
                        className={`dx-toc-link is-sub ${active === id ? "is-active" : ""}`}
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        <main className="dx-main">
          <Overview />
          <QuickStart />
          <Model />
          <ApiReference />
          <RiskScoring />
          <Cli />
          <ConsoleSection />
          <Errors />

          <footer className="dx-foot">
            <span>ChainTrace — dependency blast radius for npm and PyPI</span>
            <span>Graph reads pinned per snapshot · depth capped at 5</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── primitives ───────────────────────────────────────────────── */

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="dx-h2">
      <a href={`#${id}`} aria-label={`Link to ${String(children)}`}>
        {children}
      </a>
    </h2>
  );
}

function Code({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="dx-code">
      {lang && <span className="dx-code-lang">{lang}</span>}
      <button
        type="button"
        className="dx-copy"
        onClick={() => {
          navigator.clipboard?.writeText(children).then(
            () => {
              setCopied(true);
              timer.current = window.setTimeout(() => setCopied(false), 1400);
            },
            () => undefined,
          );
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

function Rows({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="dx-table-wrap">
      <table className="dx-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParamTable({ params, title }: { params: Param[]; title: string }) {
  return (
    <>
      <p className="dx-label">{title}</p>
      <Rows
        head={["name", "type", "default", "notes"]}
        rows={params.map((p) => [
          <code key="n" className="dx-param">
            {p.name}
            {p.required && <em title="required">*</em>}
          </code>,
          <span key="t" className="dx-type">
            {p.type}
          </span>,
          <span key="d" className="dx-dim">
            {p.default ?? (p.required ? "—" : "—")}
          </span>,
          p.about,
        ])}
      />
    </>
  );
}

/* ── sections ─────────────────────────────────────────────────── */

function Overview() {
  return (
    <section>
      <p className="ct-eyebrow">Reference</p>
      <h1 className="dx-h1">ChainTrace</h1>
      <p className="dx-lede">
        A supply-chain security platform that answers one question the usual
        tools cannot: when a package version is compromised, what does it
        actually reach? Lockfiles become a dependency graph in HydraDB, and
        every query walks it backwards — from a bad version out to the services
        that ship it, with hop counts, chains and a production-weighted score.
      </p>

      <H2 id="overview">The pieces</H2>
      <Rows
        head={["part", "what it is", "stack"]}
        rows={[
          [
            <b key="a">CLI</b>,
            "Reads a lockfile, resolves ranges, ingests, and fails your build on CRITICAL findings.",
            "Bun · TypeScript",
          ],
          [
            <b key="b">Backend API</b>,
            "16 HTTP endpoints over the graph: traversal, blast radius, attack paths, risk, typosquat, co-maintainers.",
            "Bun · OpenCypher",
          ],
          [
            <b key="c">HydraDB</b>,
            "Object-store-native distributed graph database. Every query reads one pinned snapshot.",
            "Rust · S3 · SlateDB",
          ],
          [
            <b key="d">Console</b>,
            "A UI over every endpoint, including the graph in 3D.",
            "Next.js · three.js",
          ],
        ]}
      />

      <div className="dx-note">
        <b>Two ecosystems, one graph.</b> npm and PyPI live side by side,
        separated only by the version-key prefix — <code>npm:axios@1.7.2</code>{" "}
        and <code>pypi:requests@2.32.3</code>. Every version-scoped endpoint
        takes either.
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section>
      <H2 id="quickstart">Quick start</H2>
      <p className="dx-p">
        Four processes. HydraDB holds the graph, the API serves it, the CLI
        fills it, and the console reads it.
      </p>

      <p className="dx-label">1 · HydraDB</p>
      <Code lang="bash">{`docker run -p 8443:8443 ghcr.io/hydra-db/hydradb:latest`}</Code>
      <p className="dx-p dx-dim">
        Releases up to 0.1.0 were linux/amd64 only — on Apple Silicon use a
        later tag, or add <code>--platform linux/amd64</code> to run it emulated.
      </p>

      <p className="dx-label">2 · Backend</p>
      <Code lang="bash">{`cd backend
bun install

cat > .env <<'EOF'
HYDRA_URL=http://127.0.0.1:8443
HYDRA_TOKEN=your-token
HYDRA_NAMESPACE=default
HYDRA_CELL_ID=cell-0
EOF

PORT=4000 bun run src/server.ts`}</Code>
      <p className="dx-p dx-dim">
        The server exits immediately if <code>HYDRA_URL</code> or{" "}
        <code>HYDRA_TOKEN</code> is missing. It defaults to port 3000, which
        collides with <code>next dev</code> — move one of them.
      </p>

      <p className="dx-label">3 · Ingest something</p>
      <Code lang="bash">{`export CHAINTRACE_API=http://localhost:4000

curl "$CHAINTRACE_API/packages/axios/1.7.2/ingest?depth=2"

curl -X POST "$CHAINTRACE_API/services" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "payment-api",
    "repo": "acme/payment-api",
    "team": "payments",
    "environment": "production",
    "dependencies": [{ "name": "axios", "version": "1.7.2" }]
  }'

curl "$CHAINTRACE_API/versions/npm:axios@1.7.2/blast-radius"`}</Code>
      <p className="dx-p dx-dim">
        Without the service registration the graph knows packages but not
        consequences — blast radius, attack paths and risk all return empty.
      </p>

      <p className="dx-label">4 · Console</p>
      <Code lang="bash">{`cd front-end
pnpm install
echo 'NEXT_PUBLIC_CHAINTRACE_API=http://localhost:4000' > .env.local
pnpm dev`}</Code>
      <p className="dx-p">
        Then open <Link href="/console">/console</Link>. If the API is
        unreachable every view falls back to a sample dataset and says so in the
        status chip.
      </p>
    </section>
  );
}

function Model() {
  return (
    <section>
      <H2 id="model">Graph model</H2>
      <p className="dx-p">
        Four vertex types and four edge types. Every endpoint in the API is a
        walk over this.
      </p>

      <Code>{GRAPH_MODEL}</Code>

      <p className="dx-label">Vertices</p>
      <Rows
        head={["label", "properties", "what it is"]}
        rows={VERTICES.map(([l, p, a]) => [
          <b key="l">{l}</b>,
          <code key="p" className="dx-type">
            {p}
          </code>,
          a,
        ])}
      />

      <p className="dx-label">Edges</p>
      <Rows
        head={["type", "direction", "carries"]}
        rows={EDGES.map(([t, d, a]) => [
          <code key="t" className="dx-param">
            {t}
          </code>,
          <span key="d" className="dx-type">
            {d}
          </span>,
          a,
        ])}
      />

      <div className="dx-note">
        <b>Version keys.</b> Every version-scoped path takes a whole key,
        URL-encoded: <code>npm:&lt;name&gt;@&lt;version&gt;</code> or{" "}
        <code>pypi:&lt;name&gt;@&lt;version&gt;</code>. Scoped npm packages work
        too — <code>npm:@scope/pkg@1.0.0</code>.
      </div>

      <div className="dx-note is-warn">
        <b>Known gap.</b> <code>parseVersionKey</code> in{" "}
        <code>graph-service.ts</code> only strips the <code>npm:</code> prefix,
        so <code>/packages/:name/graph</code> returns PyPI node names still
        carrying <code>pypi:</code>. The console strips either prefix for
        display; raw responses do not.
      </div>
    </section>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return <span className={`dx-method is-${method.toLowerCase()}`}>{method}</span>;
}

function EndpointCard({ e }: { e: Endpoint }) {
  return (
    <article className="dx-ep" id={e.id}>
      <header className="dx-ep-head">
        <MethodBadge method={e.method} />
        <code className="dx-ep-path">{e.path}</code>
        {e.writes && <span className="dx-writes">writes</span>}
        {e.console && (
          <Link href={e.console.href} className="dx-ep-console">
            {e.console.label}
            <PixelArrow />
          </Link>
        )}
      </header>

      <div className="dx-ep-body">
        <p className="dx-p">{e.summary}</p>
        {e.detail && <p className="dx-p dx-dim">{e.detail}</p>}

        {e.params && <ParamTable params={e.params} title="Parameters" />}
        {e.body && <ParamTable params={e.body} title="Body" />}

        {e.response && (
          <>
            <p className="dx-label">Response · 200</p>
            <Code lang="json">{e.response}</Code>
          </>
        )}

        {e.errors && (
          <>
            <p className="dx-label">Errors</p>
            <Rows
              head={["status", "body"]}
              rows={e.errors.map(([s, b]) => [
                <code key="s" className="dx-status">
                  {s}
                </code>,
                b,
              ])}
            />
          </>
        )}

        <p className="dx-label">Try it</p>
        <Code lang="bash">{e.curl}</Code>
      </div>
    </article>
  );
}

function ApiReference() {
  const count = useMemo(
    () => API.reduce((n, g) => n + g.endpoints.length, 0),
    [],
  );

  return (
    <section>
      <H2 id="api">HTTP API</H2>
      <p className="dx-p">
        {count} endpoints. All responses are JSON and carry{" "}
        <code>Access-Control-Allow-Origin: *</code>, so a browser can call the
        API directly. A preflight <code>OPTIONS</code> returns 204.
      </p>
      <Code lang="bash">{`export CHAINTRACE_API=http://localhost:4000`}</Code>

      {API.map((g) => (
        <div key={g.id}>
          <h3 id={g.id} className="dx-h3">
            <a href={`#${g.id}`}>{g.title}</a>
          </h3>
          <p className="dx-p dx-dim">{g.blurb}</p>
          {g.endpoints.map((e) => (
            <EndpointCard key={e.id} e={e} />
          ))}
        </div>
      ))}
    </section>
  );
}

function RiskScoring() {
  return (
    <section>
      <H2 id="risk">Risk scoring</H2>
      <p className="dx-p">
        Risk is computed per affected service and then rolled up to the version.
        These are the rules as implemented in{" "}
        <code>backend/src/graph/query/risk.ts</code> — a score is only useful
        with its reasons attached, and every response carries them.
      </p>

      <p className="dx-label">Per service, out of 100</p>
      <Rows
        head={["points", "condition"]}
        rows={RISK_SERVICE_RULES.map(([p, c]) => [
          <code key="p" className="dx-param">
            {p}
          </code>,
          c,
        ])}
      />
      <p className="dx-p dx-dim">
        Environment and hop distance both contribute, so a production service
        holding a direct dependency scores 90 and a development service four
        hops out scores 10.
      </p>

      <p className="dx-label">Rolled up to the version</p>
      <Rows
        head={["points", "condition"]}
        rows={RISK_ROLLUP_RULES.map(([p, c]) => [
          <code key="p" className="dx-param">
            {p}
          </code>,
          c,
        ])}
      />

      <p className="dx-label">Severity bands</p>
      <Rows
        head={["score", "severity"]}
        rows={RISK_BANDS.map(([s, sev]) => [
          <code key="s" className="dx-param">
            {s}
          </code>,
          <span key="v" className={`dx-sev is-${sev.toLowerCase()}`}>
            {sev}
          </span>,
        ])}
      />
    </section>
  );
}

function Cli() {
  return (
    <section>
      <H2 id="cli">CLI</H2>
      <p className="dx-p">
        The CLI is what puts your project in the graph. It parses the lockfile
        locally and sends package coordinates — name, version, range. It does
        not read or upload source files.
      </p>

      <p className="dx-label">Install</p>
      <Code lang="bash">{`cd cli
bun install

# run from source
bun run dev

# or build a standalone binary
bun run build
ln -s "$PWD/dist/chaintrace" /usr/local/bin/chaintrace

chaintrace --version`}</Code>

      <p className="dx-label">Configuration</p>
      <Rows
        head={["variable", "default", "what it does"]}
        rows={CLI_ENV.map(([v, d, a]) => [
          <code key="v" className="dx-param">
            {v}
          </code>,
          <span key="d" className="dx-type">
            {d}
          </span>,
          a,
        ])}
      />
      <Code lang="env">{`CHAINTRACE_API_URL=http://localhost:4000
GITHUB_CLIENT_ID=your_client_id
CHAINTRACE_DEBUG=true`}</Code>

      {CLI_COMMANDS.map((c) => (
        <article key={c.id} className="dx-ep" id={c.id}>
          <header className="dx-ep-head">
            <code className="dx-ep-path">{c.name}</code>
          </header>
          <div className="dx-ep-body">
            <p className="dx-p">{c.summary}</p>
            {c.detail && <p className="dx-p dx-dim">{c.detail}</p>}

            <p className="dx-label">Usage</p>
            <Code lang="bash">{c.usage.join("\n")}</Code>

            {c.flags && (
              <>
                <p className="dx-label">Flags</p>
                <Rows
                  head={["flag", "alias", "default", "notes"]}
                  rows={c.flags.map(([f, a, d, n]) => [
                    <code key="f" className="dx-param">
                      {f}
                    </code>,
                    <code key="a" className="dx-type">
                      {a}
                    </code>,
                    <span key="d" className="dx-dim">
                      {d}
                    </span>,
                    n,
                  ])}
                />
              </>
            )}

            {c.steps && (
              <>
                <p className="dx-label">What it does</p>
                <ol className="dx-steps">
                  {c.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </article>
      ))}

      <h3 id="lockfiles" className="dx-h3">
        <a href="#lockfiles">Lockfiles</a>
      </h3>
      <p className="dx-p">
        Detected in this order. <b>Parsed</b> means the dependencies are read
        out; <b>detected</b> means the file is recognised but not yet
        understood.
      </p>
      <Rows
        head={["tool", "file", "status", "notes"]}
        rows={LOCKFILES.map(([t, f, s, n]) => [
          t,
          <code key="f" className="dx-param">
            {f}
          </code>,
          <span
            key="s"
            className={`dx-status-chip is-${s === "parsed" ? "ok" : "partial"}`}
          >
            {s}
          </span>,
          n,
        ])}
      />

      <h3 id="exit-codes" className="dx-h3">
        <a href="#exit-codes">Exit codes</a>
      </h3>
      <Rows
        head={["code", "meaning", "when"]}
        rows={EXIT_CODES.map(([c, m, w]) => [
          <code key="c" className="dx-param">
            {c}
          </code>,
          <b key="m">{m}</b>,
          w,
        ])}
      />
      <Code lang="yaml">{CI_EXAMPLE}</Code>
    </section>
  );
}

function ConsoleSection() {
  return (
    <section>
      <H2 id="console">Console</H2>
      <p className="dx-p">
        Every view is one endpoint, rendered the way that endpoint&apos;s answer
        is shaped. Depth-based traversals get a 3D graph; ordered chains stay
        flat and readable.
      </p>

      <Rows
        head={["route", "endpoint", "view"]}
        rows={CONSOLE_VIEWS.map(([r, e, v]) => [
          <Link key="r" href={r} className="dx-link">
            {r}
          </Link>,
          <code key="e" className="dx-type">
            {e}
          </code>,
          v,
        ])}
      />

      <div className="dx-note">
        <b>One target, every page.</b> Ecosystem, package, version and depth are
        console-wide and persisted. Set them anywhere and every other view is
        already asking about the same thing.
      </div>

      <p className="dx-label">3D graph controls</p>
      <Rows
        head={["action", "result"]}
        rows={[
          ["drag", "orbit"],
          ["scroll", "zoom"],
          ["click a node", "fly to it and defocus everything off its path to hop 0"],
          ["click empty space, or Escape", "clear the selection"],
        ]}
      />
    </section>
  );
}

function Errors() {
  return (
    <section>
      <H2 id="errors">Errors</H2>
      <p className="dx-p">Every error returns the same shape.</p>
      <Code lang="json">{`{ "error": "Human-readable error message" }`}</Code>
      <Rows
        head={["status", "meaning"]}
        rows={HTTP_ERRORS.map(([s, m]) => [
          <code key="s" className="dx-status">
            {s}
          </code>,
          m,
        ])}
      />
    </section>
  );
}
