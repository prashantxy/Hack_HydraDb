"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { api, API_BASE } from "@/lib/api";
import { Wordmark } from "@/components/site/primitives";

/*
 * Console shell. The rail names the endpoint behind each view, so
 * the navigation doubles as the API map.
 */

const NAV = [
  { href: "/console", label: "Overview", route: "GET /health" },
  { href: "/console/graph", label: "Graph", route: "/packages/:n/graph" },
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

type Health = "checking" | "up" | "down";

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    api
      .health(ac.signal)
      .then(() => alive && setHealth("up"))
      .catch((e: Error) => {
        if (alive && e.name !== "AbortError") setHealth("down");
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

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

        <div className="cs-top-right">
          <span className={`cs-health is-${health}`}>
            <i aria-hidden />
            {health === "checking"
              ? "checking api"
              : health === "up"
                ? "api online"
                : "api offline"}
          </span>
          <code className="cs-top-base">{API_BASE}</code>
        </div>
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
