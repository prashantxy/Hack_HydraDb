"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";

import { api, type SecurityAnalysis } from "@/lib/api";
import { demoAttackPaths, demoBlastRadius, demoRisk } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import {
  useReportSource,
  useStatus,
  useTarget,
} from "@/components/console/console-state";
import { PageHead } from "@/components/console/shell";
import {
  EnvChip,
  Gauge,
  Panel,
  SeverityChip,
  Stat,
  Table,
  TargetBar,
  RawJson,
  VersionKey,
} from "@/components/console/ui";
import { PixelArrow } from "@/components/site/primitives";

/*
 * GET /packages/:packageName/:version/analysis?depth=
 *
 * The one endpoint that answers everything at once: risk, blast
 * radius and attack paths for a single version. This page is the
 * triage screen — one request, one verdict, and links out to the
 * dedicated views when you need to argue with a number.
 */

const short = (key: string) => key.replace(/^(npm|pypi):/, "");

export default function AnalysisPage() {
  const { target, key } = useTarget();
  const { nonce } = useStatus();

  const query = useMemo(
    () => ({
      name: target.name,
      version: target.version,
      depth: target.depth,
    }),
    [target.name, target.version, target.depth],
  );

  const load = useCallback(
    (signal: AbortSignal) =>
      api.analysis(query.name, query.version, query.depth, signal),
    [query],
  );

  /* stitched from the same sample parts the dedicated views use, so
   * demo mode stays internally consistent */
  const fallback = useCallback((): SecurityAnalysis => {
    const risk = demoRisk(key, query.depth);
    const blast = demoBlastRadius(key, query.depth);
    const paths = demoAttackPaths(key, query.depth);

    return {
      packageName: query.name,
      version: query.version,
      versionKey: key,
      risk,
      blastRadius: {
        affectedServices: blast.affectedServices,
        productionServices: risk.productionServices,
        services: blast.services,
      },
      attackPaths: {
        affectedServices: paths.affectedServices,
        paths: paths.attackPaths,
      },
      maxDepth: query.depth,
    };
  }, [key, query]);

  const { data, error, source, loading } = useApi<SecurityAnalysis>(
    `analysis:${key}:${query.depth}:${nonce}`,
    load,
    fallback,
  );

  useReportSource(source, error);

  const services = useMemo(
    () => [...(data?.risk.services ?? [])].sort((a, b) => b.score - a.score),
    [data],
  );

  const paths = useMemo(
    () => [...(data?.attackPaths.paths ?? [])].sort((a, b) => a.hops - b.hops),
    [data],
  );

  const worst = services[0] ?? null;

  return (
    <>
      <PageHead
        eyebrow="Analysis"
        title="Everything about one version"
        lede="Risk, blast radius and attack paths in a single request. Start here when an advisory lands: this is the screen that tells you whether it matters, and the links tell you why."
      />

      <TargetBar />

      <div className="cs-stats">
        <Stat
          label="Version"
          value={<VersionKey value={data?.versionKey ?? key} />}
        />
        <Stat
          label="Risk"
          value={data ? `${data.risk.score}/100` : "—"}
          tone="hot"
          hint={data?.risk.severity}
        />
        <Stat
          label="Services reached"
          value={data?.blastRadius.affectedServices ?? 0}
        />
        <Stat
          label="In production"
          value={data?.blastRadius.productionServices ?? 0}
        />
        <Stat label="Attack paths" value={paths.length} />
      </div>

      <div className="cs-grid cs-grid-main">
        <div className="cs-grid">
          <Panel
            title={`GET /packages/${query.name}/${query.version}/analysis?depth=${query.depth}`}
            meta={`${services.length} services scored`}
            flush
          >
            <Table
              columns={[
                { key: "name", head: "service", cell: (s) => s.name },
                {
                  key: "env",
                  head: "env",
                  cell: (s) => <EnvChip env={s.environment} />,
                },
                { key: "hops", head: "hops", w: "56px", cell: (s) => s.hops },
                { key: "score", head: "score", w: "62px", cell: (s) => s.score },
                {
                  key: "sev",
                  head: "severity",
                  cell: (s) => <SeverityChip value={s.severity} />,
                },
                {
                  key: "why",
                  head: "reasons",
                  cell: (s) => (
                    <ul className="cs-reasons">
                      {s.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ),
                },
              ]}
              rows={services}
              rowKey={(s) => String(s.serviceId)}
              empty={
                loading
                  ? "querying…"
                  : "No service reaches this version, so there is nothing to score."
              }
            />
          </Panel>

          <Panel title="Attack paths" meta={`${paths.length}`} flush>
            {paths.length === 0 ? (
              <p className="cs-empty">
                {loading ? "querying…" : "No path reaches this version."}
              </p>
            ) : (
              paths.map((p) => (
                <article
                  key={`${p.serviceId}-${p.path.join()}`}
                  className="cs-chain"
                >
                  <header className="cs-chain-head">
                    <span className="cs-chain-name">{p.serviceName}</span>
                    <EnvChip env={p.environment} />
                    <span className="cs-chain-hops">
                      {p.hops} hop{p.hops === 1 ? "" : "s"}
                    </span>
                  </header>

                  <div className="cs-hopline">
                    <span className="cs-hop">
                      <i aria-hidden />
                      {p.serviceName}
                    </span>
                    {p.path.map((step, i) => (
                      <span
                        key={`${step}-${i}`}
                        style={{ display: "inline-flex", alignItems: "stretch" }}
                      >
                        <span className="cs-hop-arrow" aria-hidden>
                          →
                        </span>
                        <span
                          className={`cs-hop ${i === p.path.length - 1 ? "is-target" : ""}`}
                        >
                          <i aria-hidden />
                          {short(step)}
                        </span>
                      </span>
                    ))}
                  </div>
                </article>
              ))
            )}
          </Panel>
        </div>

        <div className="cs-grid">
          <Panel title="Verdict">
            {data ? (
              <Gauge score={data.risk.score} severity={data.risk.severity} />
            ) : (
              <p className="cs-empty">querying…</p>
            )}

            {worst && (
              <dl className="cs-kv" style={{ marginTop: ".4rem" }}>
                <dt>worst hit</dt>
                <dd>{worst.name}</dd>
                <dt>env</dt>
                <dd>
                  <EnvChip env={worst.environment} />
                </dd>
                <dt>hops</dt>
                <dd>{worst.hops}</dd>
                <dt>depth</dt>
                <dd>{data?.maxDepth ?? query.depth}</dd>
              </dl>
            )}
          </Panel>

          <Panel title="Dig in">
            <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
              These views ask the same question of one endpoint each, on the
              version you already have selected.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: ".4rem",
                marginTop: ".9rem",
              }}
            >
              {[
                ["/console/graph", "Dependency graph"],
                ["/console/blast", "Blast radius"],
                ["/console/paths", "Attack paths"],
                ["/console/risk", "Risk breakdown"],
                ["/console/maintainers", "Co-maintainers"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="cs-jump">
                  {label}
                  <PixelArrow />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
