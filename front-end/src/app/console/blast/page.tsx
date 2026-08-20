"use client";

import { useCallback, useMemo, useState } from "react";

import {
  api,
  versionKey,
  type BlastRadius,
  type Ecosystem,
} from "@/lib/api";
import { stripEcosystem } from "@/lib/api";
import { demoBlastRadius, scoreService } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { Graph3D, type Edge3D, type Node3D } from "@/components/console/graph-3d";
import { PageHead } from "@/components/console/shell";
import {
  EnvChip,
  Panel,
  QueryBar,
  RawJson,
  SeverityChip,
  SourceBadge,
  Stat,
  Table,
  VersionKey,
} from "@/components/console/ui";

/*
 * GET /versions/:versionKey/blast-radius?depth=
 *
 * The endpoint answers one question — which services reach this
 * version, and from how far — so the view puts the compromised
 * version at the origin and drops each service on the shell for its
 * hop count. Colour is severity from the same rules /risk uses.
 */

const SEV_RGB: Record<string, [number, number, number]> = {
  CRITICAL: [0.94, 0.27, 0.24],
  HIGH: [1, 0.54, 0.24],
  MEDIUM: [0.94, 0.75, 0.3],
  LOW: [0.29, 0.87, 0.5],
};

export default function BlastPage() {
  const [ecosystem, setEcosystem] = useState<Ecosystem>("npm");
  const [pkg, setPkg] = useState("http-errors");
  const [version, setVersion] = useState("2.0.0");
  const [depth, setDepth] = useState(5);
  const [query, setQuery] = useState({
    key: versionKey("http-errors", "2.0.0", "npm"),
    depth: 5,
  });
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(
    (signal: AbortSignal) => api.blastRadius(query.key, query.depth, signal),
    [query],
  );
  const fallback = useCallback(
    () => demoBlastRadius(query.key, query.depth),
    [query],
  );

  const { data, error, source, loading, reload } = useApi<BlastRadius>(
    `blast:${query.key}:${query.depth}`,
    load,
    fallback,
  );

  /* score locally with the backend's own rules so the view can rank
   * and colour without a second request */
  const scored = useMemo(
    () =>
      (data?.services ?? [])
        .map((s) => ({ ...s, risk: scoreService(s) }))
        .sort((a, b) => b.risk.score - a.risk.score),
    [data],
  );

  const production = scored.filter(
    (s) => s.environment?.toLowerCase() === "production",
  ).length;

  const nearest = scored.length ? Math.min(...scored.map((s) => s.hops)) : null;

  const nodes: Node3D[] = useMemo(() => {
    const root: Node3D = {
      id: query.key,
      label: stripEcosystem(query.key),
      meta: "compromised",
      depth: 0,
    };

    return [
      root,
      ...scored.map((s) => ({
        id: `svc:${s.id}`,
        label: s.name,
        /* the shell is max(1, hops) so services never land on the
         * origin — the label reports the real hop count */
        meta: `${s.hops} hop${s.hops === 1 ? "" : "s"}`,
        sublabel: `${s.environment ?? "unknown"} · risk ${s.risk.score}`,
        depth: Math.max(1, s.hops),
        color: SEV_RGB[s.risk.severity],
      })),
    ];
  }, [scored, query.key]);

  const edges: Edge3D[] = useMemo(
    () =>
      scored.map((s) => ({
        source: query.key,
        target: `svc:${s.id}`,
      })),
    [scored, query.key],
  );

  const run = () => {
    setSelected(null);
    setQuery({
      key: versionKey(pkg.trim(), version.trim(), ecosystem),
      depth,
    });
  };

  const selectedService =
    scored.find((s) => `svc:${s.id}` === selected) ?? null;

  return (
    <>
      <PageHead
        eyebrow="Blast radius"
        title="Which services this version reaches"
        lede="Reverse DEPENDS_ON traversal from one version out to the services that ship it. Distance from the centre is hop count — the difference between an upgrade you schedule and one you page for."
      >
        <SourceBadge
          source={source}
          error={error}
          loading={loading}
          onReload={reload}
        />
      </PageHead>

      <QueryBar
        ecosystem={ecosystem}
        onEcosystem={setEcosystem}
        fields={[
          {
            id: "pkg",
            label: "package",
            value: pkg,
            onChange: setPkg,
            placeholder: ecosystem === "npm" ? "http-errors" : "requests",
          },
          {
            id: "version",
            label: "version",
            value: version,
            onChange: setVersion,
            placeholder: ecosystem === "npm" ? "2.0.0" : "2.32.3",
          },
        ]}
        depth={depth}
        onDepth={setDepth}
        onSubmit={run}
      >
        <span className="cs-stat-hint" style={{ alignSelf: "center" }}>
          key{" "}
          <VersionKey
            value={versionKey(pkg.trim(), version.trim(), ecosystem)}
          />
        </span>
      </QueryBar>

      <div className="cs-stats">
        <Stat
          label="Services reached"
          value={data?.affectedServices ?? 0}
          tone="hot"
        />
        <Stat label="In production" value={production} />
        <Stat
          label="Nearest hop"
          value={nearest === null ? "—" : nearest}
          hint={nearest === 0 ? "direct dependency" : undefined}
        />
        <Stat label="Max depth" value={data?.maxDepth ?? query.depth} />
        <Stat
          label="Worst severity"
          value={scored[0]?.risk.severity ?? "—"}
        />
      </div>

      <div className="cs-grid cs-grid-main">
        <Panel
          title={`GET /versions/${query.key}/blast-radius?depth=${query.depth}`}
          meta={`${scored.length} services`}
          flush
        >
          {scored.length === 0 ? (
            <p className="cs-empty">
              {loading
                ? "querying…"
                : "No service reaches this version. Register services with POST /services to populate this view."}
            </p>
          ) : (
            <>
              <Graph3D
                nodes={nodes}
                edges={edges}
                selected={selected}
                onSelect={setSelected}
              />
              <div className="cs-legend">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => (
                  <span key={s} className="cs-legend-item">
                    <i
                      style={{
                        background: `rgb(${SEV_RGB[s].map((v) => Math.round(v * 255)).join(",")})`,
                      }}
                      aria-hidden
                    />
                    {s.toLowerCase()}
                  </span>
                ))}
              </div>
              <div className="cs-hintbar">
                <span>shell = hop distance</span>
                <span>colour = severity</span>
                <span>
                  edges are drawn to the origin — for the real chain, see attack
                  paths
                </span>
              </div>
            </>
          )}
        </Panel>

        <div className="cs-grid">
          <Panel title="Service">
            {selectedService ? (
              <dl className="cs-kv">
                <dt>name</dt>
                <dd>{selectedService.name}</dd>
                <dt>repo</dt>
                <dd>{selectedService.repo || "—"}</dd>
                <dt>team</dt>
                <dd>{selectedService.team ?? "—"}</dd>
                <dt>env</dt>
                <dd>
                  <EnvChip env={selectedService.environment} />
                </dd>
                <dt>hops</dt>
                <dd>{selectedService.hops}</dd>
                <dt>risk</dt>
                <dd>
                  {selectedService.risk.score}/100{" "}
                  <SeverityChip value={selectedService.risk.severity} />
                </dd>
                <dt>reasons</dt>
                <dd>
                  <ul className="cs-reasons">
                    {selectedService.risk.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
            ) : (
              <p className="cs-empty">
                Select a service in the view or the table.
              </p>
            )}
          </Panel>

          <Panel title="Reached services" meta={`${scored.length}`} flush>
            <Table
              columns={[
                { key: "name", head: "service", cell: (s) => s.name },
                {
                  key: "env",
                  head: "env",
                  cell: (s) => <EnvChip env={s.environment} />,
                },
                { key: "hops", head: "hops", w: "60px", cell: (s) => s.hops },
                {
                  key: "sev",
                  head: "severity",
                  cell: (s) => <SeverityChip value={s.risk.severity} />,
                },
              ]}
              rows={scored}
              rowKey={(s) => `svc:${s.id}`}
              activeKey={selected}
              onRowClick={(s) =>
                setSelected(selected === `svc:${s.id}` ? null : `svc:${s.id}`)
              }
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
