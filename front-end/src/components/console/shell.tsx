"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { api, API_BASE } from "@/lib/api";
import { Wordmark } from "@/components/site/primitives";
import { useStatus } from "./console-state";

/*
 * Console shell. The rail names the endpoint behind each view, so
 * the navigation doubles as the API map.
 *
 * Connection state lives in exactly one place — the top right — and
 * describes what is actually on screen: live if the last request came
 * from the API, sample if it fell back. Pages report into it via
 * useReportSource instead of printing their own badges.
 */

const NAV = [
  { href: "/console", label: "Overview", route: "GET /health" },
  { href: "/console/graph", label: "Graph", route: "/packages/:n/graph" },
  { href: "/console/analysis", label: "Analysis", route: "/:n/:v/analysis" },
  { href: "/console/blast", label: "Blast radius", route: "/blast-radius" },
  { href: "/console/paths", label: "Attack paths", route: "/attack-path" },
  { href: "/console/risk", label: "Risk", route: "/risk" },
  {
    href: "/console/maintainers",
    label: "Co-maintainers",
    route: "/co-maintainers",
  },
  {
    href: "/console/lockfile",
    label: "Lockfile resolve",
    route: "POST /lockfiles",
  },
  { href: "/console/typosquat", label: "Typosquat", route: "/typosquat/:n" },
  { href: "/console/services", label: "Services", route: "GET /services" },
];

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="ct cs">
      <header className="cs-top">
        <Link href="/" className="cs-brand" aria-label="ChainTrace home">
          <span className="cs-brand-mark">
            <Wordmark />
          </span>
        </Link>

        <span className="cs-top-sep" aria-hidden />
        <span className="cs-top-title">Console</span>

        <ConnectionState />
      </header>

      <div className="cs-body">
        <nav className="cs-rail" aria-label="Console sections">
          <p className="cs-rail-label">Endpoints</p>

          {NAV.map((item) => {
            const active =
              item.href === "/console"
                ? pathname === "/console"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cs-rail-link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="cs-rail-name">{item.label}</span>
                <span className="cs-rail-route">{item.route}</span>
              </Link>
            );
          })}

          <p className="cs-rail-label" style={{ marginTop: "1.5rem" }}>
            Reference
          </p>
          <Link href="/" className="cs-rail-link">
            <span className="cs-rail-name">Landing page</span>
            <span className="cs-rail-route">/</span>
          </Link>
        </nav>

        <main className="cs-main">{children}</main>
      </div>
    </div>
  );
}

/* the one connection indicator in the app */
function ConnectionState() {
  const { source, error, refresh } = useStatus();
  const [probing, setProbing] = useState(true);

  /* an initial probe so the indicator is meaningful before the first
   * page request resolves */
  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    api
      .health(ac.signal)
      .catch(() => undefined)
      .finally(() => {
        if (alive) setProbing(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  const state = probing ? "checking" : source === "live" ? "live" : "sample";

  const label =
    state === "checking"
      ? "connecting"
      : state === "live"
        ? "live"
        : "sample data";

  return (
    <button
      type="button"
      className={`cs-conn is-${state}`}
      onClick={() => {
        setProbing(true);
        refresh();
        window.setTimeout(() => setProbing(false), 400);
      }}
      title={
        state === "sample"
          ? `${error ?? "API unreachable"} — showing the sample dataset. Click to retry. API base: ${API_BASE}`
          : `API base: ${API_BASE}. Click to refetch.`
      }
      aria-label={`${label}. Click to refetch.`}
    >
      <i aria-hidden />
      <span>{label}</span>
    </button>
  );
}

/* page header used by every view */
export function PageHead({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <div className="cs-pagehead">
      <div>
        <p className="ct-eyebrow">{eyebrow}</p>
        <h1 className="cs-h1">{title}</h1>
        <p className="cs-lede">{lede}</p>
      </div>
      {children}
    </div>
  );
}
