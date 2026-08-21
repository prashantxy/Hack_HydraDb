"use client";

import { useCallback, useMemo, useState } from "react";

import {
  api,
  type PackageRisk,
} from "@/lib/api";
import { demoRisk } from "@/lib/demo";
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
  TargetBar,
  RawJson,
  SeverityChip,
  Stat,
  Table,
  VersionKey,
} from "@/components/console/ui";

/*
 * GET /versions/:versionKey/risk?depth=
 *
 * The score is only useful with its reasons attached, so the rules
 * that produced it are on the page next to the number. They are the
 * live rules from backend/src/graph/query/risk.ts.
 */

const SERVICE_RULES: [string, string][] = [
  ["+60", "environment is production"],
  ["+30", "environment is staging"],
  ["+10", "any other environment"],
  ["+30", "direct dependency (0 hops)"],
  ["+20", "one hop away"],
  ["+10", "within three hops"],
];

const PACKAGE_RULES: [string, string][] = [
  ["max", "the worst affected service sets the floor"],
  ["+10", "two or more production services affected"],
  ["+10", "five or more production services affected"],
];

const BANDS: [string, string][] = [
  ["≥ 80", "CRITICAL"],
  ["≥ 60", "HIGH"],
  ["≥ 30", "MEDIUM"],
  ["< 30", "LOW"],
];

export default function RiskPage() {
  const [selected, setSelected] = useState<number | null>(null);

  const { target, key } = useTarget();
  const { nonce } = useStatus();
  const query = useMemo(
    () => ({ key, depth: target.depth }),
    [key, target.depth],
  );

  const load = useCallback(
    (signal: AbortSignal) => api.risk(query.key, query.depth, signal),
    [query],
  );
  const fallback = useCallback(() => demoRisk(query.key, query.depth), [query]);

  const { data, error, source, loading } = useApi<PackageRisk>(
    `risk:${query.key}:${query.depth}:${nonce}`,
    load,
    fallback,
  );

  useReportSource(source, error);

  const services = useMemo(
    () => [...(data?.services ?? [])].sort((a, b) => b.score - a.score),
    [data],
  );

  const selectedService =
    services.find((s) => s.serviceId === selected) ?? services[0] ?? null;


  return (
    <>
      <PageHead
        eyebrow="Risk"
        title="Scored where it lands"
        lede="Risk is computed per service, then rolled up to the version. Production weighs heaviest, hop distance next, and every score carries the reasons that produced it."
      />

      <TargetBar />

      <div className="cs-grid cs-grid-main">
        <div className="cs-grid">
          <div className="cs-stats">
            <Stat
              label="Affected services"
              value={data?.affectedServices ?? 0}
              tone="hot"
            />
            <Stat label="In production" value={data?.productionServices ?? 0} />
            <Stat label="Depth" value={data?.maxDepth ?? query.depth} />
            <Stat label="Version" value={<VersionKey value={query.key} />} />
          </div>

          <Panel
            title={`GET /versions/${query.key}/risk?depth=${query.depth}`}
            meta={`${services.length} scored`}
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
                {
                  key: "score",
                  head: "score",
                  w: "150px",
                  cell: (s) => (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".5rem",
                      }}
                    >
                      <b style={{ fontWeight: 400, color: "var(--fg)" }}>
                        {s.score}
                      </b>
                      <span
                        aria-hidden
                        style={{
                          display: "block",
                          height: 4,
                          flex: 1,
                          background: "rgba(255,255,255,.08)",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${s.score}%`,
                            background:
                              s.severity === "CRITICAL"
                                ? "var(--crit)"
                                : s.severity === "HIGH"
                                  ? "var(--high)"
                                  : s.severity === "MEDIUM"
                                    ? "var(--med)"
                                    : "var(--low)",
                          }}
                        />
                      </span>
                    </span>
                  ),
                },
                {
                  key: "sev",
                  head: "severity",
                  cell: (s) => <SeverityChip value={s.severity} />,
                },
              ]}
              rows={services}
              rowKey={(s) => String(s.serviceId)}
              activeKey={selectedService ? String(selectedService.serviceId) : null}
              onRowClick={(s) => setSelected(s.serviceId)}
              empty={
                loading
                  ? "querying…"
                  : "No affected services, so there is nothing to score."
              }
            />
          </Panel>

          <div className="cs-grid cs-grid-2">
            <Panel title="Per-service rules" flush>
              <Table
                columns={[
                  { key: "pts", head: "pts", w: "58px", cell: (r) => r[0] },
                  { key: "why", head: "condition", cell: (r) => r[1] },
                ]}
                rows={SERVICE_RULES}
                rowKey={(r) => r[1]}
              />
            </Panel>

            <Panel title="Roll-up + bands" flush>
              <Table
                columns={[
                  { key: "pts", head: "pts", w: "58px", cell: (r) => r[0] },
                  { key: "why", head: "condition", cell: (r) => r[1] },
                ]}
                rows={PACKAGE_RULES}
                rowKey={(r) => r[1]}
              />
              <Table
                columns={[
                  { key: "band", head: "score", w: "58px", cell: (r) => r[0] },
                  {
                    key: "sev",
                    head: "severity",
                    cell: (r) => (
                      <SeverityChip
                        value={r[1] as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"}
                      />
                    ),
                  },
                ]}
                rows={BANDS}
                rowKey={(r) => r[0]}
              />
            </Panel>
          </div>
        </div>

        <div className="cs-grid">
          <Panel title="Version score">
            {data ? (
              <Gauge score={data.score} severity={data.severity} />
            ) : (
              <p className="cs-empty">querying…</p>
            )}
          </Panel>

          {selectedService && (
            <Panel title="Why this score" meta={selectedService.name}>
              <dl className="cs-kv">
                <dt>service</dt>
                <dd>{selectedService.name}</dd>
                <dt>env</dt>
                <dd>
                  <EnvChip env={selectedService.environment} />
                </dd>
                <dt>hops</dt>
                <dd>{selectedService.hops}</dd>
                <dt>score</dt>
                <dd>
                  {selectedService.score}/100{" "}
                  <SeverityChip value={selectedService.severity} />
                </dd>
              </dl>

              <ul className="cs-reasons" style={{ marginTop: ".9rem" }}>
                {selectedService.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
