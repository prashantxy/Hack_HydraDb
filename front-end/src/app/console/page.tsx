"use client";

import Link from "next/link";
import { useCallback } from "react";

import { api, API_BASE, type ServicesResponse } from "@/lib/api";
import { DEMO_SERVICES } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { PageHead } from "@/components/console/shell";
import { Panel, SourceBadge, Stat, Table } from "@/components/console/ui";
import { PixelArrow } from "@/components/site/primitives";

/*
 * Console index: the API surface as a map, plus whatever the graph
 * can tell us about itself right now.
 */

const VIEWS = [
  {
    href: "/console/graph",
    route: "GET /packages/:name/graph?depth=",
    title: "Dependency graph",
    body: "The traversal rendered in 3D, one sphere shell per hop, with the subtree of any node isolatable in a click.",
  },
  {
    href: "/console/blast",
    route: "GET /versions/:key/blast-radius",
    title: "Blast radius",
    body: "Which services reach a version, and from how far. Distance from the centre is hop count; colour is severity.",
  },
  {
    href: "/console/paths",
    route: "GET /versions/:key/attack-path",
    title: "Attack paths",
    body: "Every route from a service to the compromised version, in order, so the finding can be argued with.",
  },
  {
    href: "/console/risk",
    route: "GET /versions/:key/risk",
    title: "Risk",
    body: "Score per service with the reasons attached, rolled up to the version, next to the rules that produced it.",
  },
  {
    href: "/console/maintainers",
    route: "GET /versions/:key/co-maintainers",
    title: "Co-maintainers",
    body: "Everything else the same accounts can publish. A stolen token is not scoped to the package you noticed.",
  },
  {
    href: "/console/lockfile",
    route: "POST /lockfiles/resolve",
    title: "Lockfile resolve",
    body: "Paste pinned lockfile lines and see which ones actually resolved to the compromised version, and for whom.",
  },
  {
    href: "/console/typosquat",
    route: "GET /typosquat/:name",
    title: "Typosquat",
    body: "Package names within a few edits of a target, with shared-prefix and popularity signals alongside the distance.",
  },
  {
    href: "/console/services",
    route: "GET /services",
    title: "Services",
    body: "The registry that turns a package graph into an impact graph: repo, team, environment, versions shipped.",
  },
];

const OTHER_ROUTES: [string, string][] = [
  ["GET /health", "liveness"],
  ["GET /packages/:name", "package info and known versions"],
  ["GET /versions/:key/dependencies", "direct dependencies of one version"],
  ["GET /packages/:name/:version/analysis", "risk + blast radius + paths in one call"],
  ["GET /packages/:name/:version/risk", "risk addressed by package and version"],
  ["GET /packages/:name/:version/ingest", "crawl npm and write the graph (writes)"],
  ["GET /pypi/:name/:version/ingest", "crawl PyPI and write the graph (writes)"],
  ["POST /services", "register a service and its dependencies (writes)"],
];

const SCHEMA = `(:Package)-[:HAS_VERSION]->(:Version)
(:Version)-[:DEPENDS_ON]->(:Version)
(:Service)-[:DEPENDS_ON_VERSION]->(:Version)
(:Maintainer)-[:MAINTAINS]->(:Package)`;

export default function ConsoleHome() {
  const load = useCallback((signal: AbortSignal) => api.services(signal), []);
  const fallback = useCallback(
    (): ServicesResponse => ({
      success: true,
      count: DEMO_SERVICES.length,
      services: DEMO_SERVICES.map(({ id, name, repo, team, environment }) => ({
        id,
        name,
        repo,
        team,
        environment,
      })),
    }),
    [],
  );

  const { data, error, source, loading, reload } = useApi<ServicesResponse>(
    "overview-services",
    load,
    fallback,
  );

  const services = data?.services ?? [];

  return (
    <>
      <PageHead
        eyebrow="Console"
        title="The API, made operable"
        lede="Every view here is one endpoint, rendered the way that endpoint's answer is actually shaped. Depth-based traversals get a 3D graph; ordered chains stay flat and readable. The graph holds npm and PyPI side by side."
      >
        <SourceBadge
          source={source}
          error={error}
          loading={loading}
          onReload={reload}
        />
      </PageHead>

      <div className="cs-stats">
        <Stat label="API base" value={API_BASE.replace(/^https?:\/\//, "")} />
        <Stat label="Services" value={services.length} tone="hot" />
        <Stat
          label="Production"
          value={
            services.filter((s) => s.environment?.toLowerCase() === "production")
              .length
          }
        />
        <Stat
          label="Ecosystems"
          value="npm · pypi"
          hint="npm: / pypi: key prefixes"
        />
      </div>

      <div className="cs-cards">
        {VIEWS.map((v) => (
          <Link key={v.href} href={v.href} className="cs-card">
            <span className="cs-card-route">{v.route}</span>
            <h3>{v.title}</h3>
            <p>{v.body}</p>
            <span className="cs-card-go">
              Open
              <PixelArrow />
            </span>
          </Link>
        ))}
      </div>

      <div className="cs-grid cs-grid-2">
        <Panel title="Graph model" meta="what every query walks">
          <pre
            className="ct-mono"
            style={{
              padding: ".8rem",
              border: "1px solid var(--line)",
              borderLeft: "2px solid var(--sig)",
              background: "var(--ink)",
              color: "var(--fg-2)",
              lineHeight: 1.9,
              overflowX: "auto",
            }}
          >
            {SCHEMA}
          </pre>
          <p style={{ fontSize: 13, color: "var(--fg-2)", marginTop: ".9rem" }}>
            Traversal runs level by level rather than as a variable-length
            Cypher path, which is why every response carries an explicit hop
            depth — and why this console can lay it out in space. Version keys
            are prefixed <code>npm:</code> or <code>pypi:</code>, which is the
            only thing separating the two ecosystems in the graph.
          </p>
        </Panel>

        <Panel title="Rest of the surface" flush>
          <Table
            columns={[
              {
                key: "route",
                head: "route",
                cell: (r) => (
                  <code style={{ color: "var(--fg)" }}>{r[0]}</code>
                ),
              },
              { key: "what", head: "does", cell: (r) => r[1] },
            ]}
            rows={OTHER_ROUTES}
            rowKey={(r) => r[0]}
          />
        </Panel>
      </div>
    </>
  );
}
