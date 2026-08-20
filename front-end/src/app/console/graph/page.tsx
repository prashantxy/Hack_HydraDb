"use client";

import { useCallback, useMemo, useState } from "react";

import { api, stripEcosystem, type PackageGraph } from "@/lib/api";
import { DEMO_PACKAGE, demoGraph } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { Graph3D, type Edge3D, type Node3D } from "@/components/console/graph-3d";
import { PageHead } from "@/components/console/shell";
import {
  DepthLegend,
  Panel,
  QueryBar,
  RawJson,
  SourceBadge,
  Stat,
  Table,
  VersionKey,
} from "@/components/console/ui";

/*
 * GET /packages/:packageName/graph?depth=1..5
 *
 * The response already carries a depth per node, which is the one
 * thing a flat list of dependencies cannot show you — so depth is
 * the spatial axis here: hop 0 at the origin, one shell per hop.
 */

export default function GraphPage() {
  const [pkg, setPkg] = useState(DEMO_PACKAGE);
  const [depth, setDepth] = useState(3);
  const [query, setQuery] = useState({ pkg: DEMO_PACKAGE, depth: 3 });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(
    (signal: AbortSignal) => api.packageGraph(query.pkg, query.depth, signal),
    [query],
  );
  const fallback = useCallback(
    () => demoGraph(query.pkg, query.depth),
    [query],
  );

  const { data, error, source, loading, reload } = useApi<PackageGraph>(
    `graph:${query.pkg}:${query.depth}`,
    load,
    fallback,
  );

  const nodes: Node3D[] = useMemo(
    () =>
      (data?.nodes ?? []).map((n) => ({
        id: n.id,
        /* graph-service only strips the "npm:" prefix server-side, so
         * pypi nodes still carry theirs */
        label: stripEcosystem(n.packageName),
        sublabel: n.version,
        depth: n.depth,
      })),
    [data],
  );

  const edges: Edge3D[] = useMemo(
    () =>
      (data?.edges ?? []).map((e) => ({
        source: e.source,
        target: e.target,
        kind: e.dependencyType,
      })),
    [data],
  );

  const maxDepth = useMemo(
    () => Math.max(0, ...nodes.map((n) => n.depth)),
    [nodes],
  );

  const perDepth = useMemo(() => {
    const counts = new Map<number, number>();
    for (const n of nodes) counts.set(n.depth, (counts.get(n.depth) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [nodes]);

  /* finding one package by eye in a 48-node cloud is hopeless, so
   * the list is the primary way in and the view follows it */
  const listed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = data?.nodes ?? [];
    return (
      q
        ? rows.filter((n) =>
            stripEcosystem(n.packageName).toLowerCase().includes(q),
          )
        : rows
    )
      .slice()
      .sort(
        (a, b) =>
          a.depth - b.depth ||
          stripEcosystem(a.packageName).localeCompare(
            stripEcosystem(b.packageName),
          ),
      );
  }, [data, filter]);

  const selectedNode = data?.nodes.find((n) => n.id === selected) ?? null;

  const selectedEdges = useMemo(
    () =>
      (data?.edges ?? []).filter(
        (e) => e.source === selected || e.target === selected,
      ),
    [data, selected],
  );

  const run = () => {
    setSelected(null);
    setQuery({ pkg: pkg.trim() || DEMO_PACKAGE, depth });
  };

  return (
    <>
      <PageHead
        eyebrow="Dependency graph"
        title="The tree, in three dimensions"
        lede="Every hop gets its own shell. A subtree stays in one cone, so the shape you see is the shape the traversal walked. Click a node to isolate its path back to hop 0."
      >
        <SourceBadge
          source={source}
          error={error}
          loading={loading}
          onReload={reload}
        />
      </PageHead>

      <QueryBar
        fields={[
          {
            id: "pkg",
            label: "package",
            value: pkg,
            onChange: setPkg,
            placeholder: "express",
          },
        ]}
        depth={depth}
        onDepth={setDepth}
        onSubmit={run}
      />

      <div className="cs-stats">
        <Stat label="Root" value={data?.package ?? "—"} />
        <Stat label="Versions" value={nodes.length} tone="hot" />
        <Stat label="DEPENDS_ON edges" value={edges.length} />
        <Stat label="Deepest hop" value={maxDepth} />
        <Stat
          label="Requested depth"
          value={query.depth}
          hint={`capped at 5 by the api`}
        />
      </div>

      <div className="cs-grid cs-grid-main">
        <Panel
          title={`GET /packages/${query.pkg}/graph?depth=${query.depth}`}
          meta={`${nodes.length} nodes · ${edges.length} edges`}
          flush
        >
          {nodes.length === 0 ? (
            <p className="cs-empty">
              {loading
                ? "querying…"
                : "No versions returned. Ingest the package first, or try another name."}
            </p>
          ) : (
            <>
              <Graph3D
                nodes={nodes}
                edges={edges}
                selected={selected}
                onSelect={setSelected}
              />
              <DepthLegend max={maxDepth} />
              <div className="cs-hintbar">
                <span>drag to orbit</span>
                <span>scroll to zoom</span>
                <span>click a node to trace it back to hop 0</span>
                <span>node size = degree</span>
              </div>
            </>
          )}
        </Panel>

        <div className="cs-grid">
          <Panel title="Inspector">
            {selectedNode ? (
              <dl className="cs-kv">
                <dt>key</dt>
                <dd>
                  <VersionKey value={selectedNode.id} />
                </dd>
                <dt>package</dt>
                <dd>{stripEcosystem(selectedNode.packageName)}</dd>
                <dt>version</dt>
                <dd>{selectedNode.version}</dd>
                <dt>hop</dt>
                <dd>{selectedNode.depth}</dd>
                <dt>edges</dt>
                <dd>
                  {
                    selectedEdges.filter((e) => e.source === selectedNode.id)
                      .length
                  }{" "}
                  out ·{" "}
                  {
                    selectedEdges.filter((e) => e.target === selectedNode.id)
                      .length
                  }{" "}
                  in
                </dd>
              </dl>
            ) : (
              <p className="cs-empty">Select a node to inspect it.</p>
            )}
          </Panel>

          {selectedNode && selectedEdges.length > 0 && (
            <Panel
              title="Incident edges"
              meta={`${selectedEdges.length}`}
              flush
            >
              <Table
                columns={[
                  {
                    key: "dir",
                    head: "dir",
                    w: "44px",
                    cell: (e) => (e.source === selectedNode.id ? "out" : "in"),
                  },
                  {
                    key: "other",
                    head: "package",
                    cell: (e) => {
                      const other =
                        e.source === selectedNode.id ? e.target : e.source;
                      return <VersionKey value={other} />;
                    },
                  },
                  {
                    key: "range",
                    head: "range",
                    cell: (e) => e.versionRange ?? "—",
                  },
                ]}
                rows={selectedEdges}
                rowKey={(e) => `${e.source}->${e.target}`}
                onRowClick={(e) =>
                  setSelected(
                    e.source === selectedNode.id ? e.target : e.source,
                  )
                }
              />
            </Panel>
          )}

          <Panel
            title="Versions"
            meta={`${listed.length} of ${nodes.length}`}
            flush
          >
            <div style={{ padding: ".6rem .6rem 0" }}>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="filter by package…"
                spellCheck={false}
                style={{
                  width: "100%",
                  font: "12px var(--font-jetbrains-mono), monospace",
                  color: "var(--fg)",
                  background: "var(--ink)",
                  border: "1px solid var(--line-2)",
                  padding: ".45rem .5rem",
                }}
              />
            </div>

            <div style={{ maxHeight: 250, overflowY: "auto" }}>
              <Table
                columns={[
                  {
                    key: "pkg",
                    head: "package",
                    cell: (n) => stripEcosystem(n.packageName),
                  },
                  { key: "v", head: "version", cell: (n) => n.version },
                  { key: "hop", head: "hop", w: "48px", cell: (n) => n.depth },
                ]}
                rows={listed}
                rowKey={(n) => n.id}
                activeKey={selected}
                onRowClick={(n) =>
                  setSelected(selected === n.id ? null : n.id)
                }
                empty="No package matches that filter."
              />
            </div>
          </Panel>

          <Panel title="Nodes per hop" flush>
            <Table
              columns={[
                { key: "d", head: "hop", w: "60px", cell: (r) => r[0] },
                { key: "n", head: "versions", cell: (r) => r[1] },
                {
                  key: "bar",
                  head: "",
                  cell: (r) => (
                    <span
                      style={{
                        display: "block",
                        height: 4,
                        width: `${(r[1] / Math.max(...perDepth.map((p) => p[1]))) * 100}%`,
                        background: "var(--sig)",
                        opacity: 0.75,
                      }}
                    />
                  ),
                },
              ]}
              rows={perDepth}
              rowKey={(r) => String(r[0])}
            />
          </Panel>
        </div>
      </div>

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
