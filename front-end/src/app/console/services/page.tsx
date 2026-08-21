"use client";

import { useCallback, useMemo } from "react";

import { api, type ServicesResponse } from "@/lib/api";
import { DEMO_SERVICES } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { useReportSource } from "@/components/console/console-state";
import { PageHead } from "@/components/console/shell";
import {
  EnvChip,
  Panel,
  RawJson,
  Stat,
  Table,
} from "@/components/console/ui";

/*
 * GET /services
 *
 * Services are what turn a package graph into an impact graph: a
 * DEPENDS_ON_VERSION edge from a service is what every blast-radius,
 * attack-path and risk answer is ultimately counting.
 */

const REGISTER_EXAMPLE = `curl -X POST $CHAINTRACE_API/services \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "checkout-api",
    "repo": "acme/checkout-api",
    "team": "payments",
    "environment": "production",
    "dependencies": [
      { "name": "express", "version": "4.19.2" }
    ]
  }'`;

export default function ServicesPage() {
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

  const { data, error, source, loading } = useApi<ServicesResponse>(
    "services",
    load,
    fallback,
  );

  useReportSource(source, error);

  const services = useMemo(() => data?.services ?? [], [data]);

  const byEnv = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) {
      const k = (s.environment ?? "unknown").toLowerCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [services]);

  const byTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) {
      const k = s.team ?? "unassigned";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [services]);

  return (
    <>
      <PageHead
        eyebrow="Services"
        title="Who ships what"
        lede="A service names its repo, team and environment, and the versions it depends on. Without these edges the graph knows packages but not consequences."
      />

      <div className="cs-stats">
        <Stat label="Registered" value={services.length} tone="hot" />
        <Stat
          label="Production"
          value={
            services.filter(
              (s) => s.environment?.toLowerCase() === "production",
            ).length
          }
        />
        <Stat label="Environments" value={byEnv.length} />
        <Stat label="Teams" value={byTeam.length} />
      </div>

      <div className="cs-grid cs-grid-main">
        <Panel title="GET /services" meta={`${services.length} rows`} flush>
          <Table
            columns={[
              { key: "id", head: "id", w: "56px", cell: (s) => s.id },
              { key: "name", head: "service", cell: (s) => s.name },
              {
                key: "repo",
                head: "repo",
                cell: (s) => s.repo || "—",
              },
              { key: "team", head: "team", cell: (s) => s.team ?? "—" },
              {
                key: "env",
                head: "env",
                cell: (s) => <EnvChip env={s.environment} />,
              },
            ]}
            rows={services}
            rowKey={(s) => String(s.id)}
            empty={
              loading ? "querying…" : "No services registered on this graph yet."
            }
          />
        </Panel>

        <div className="cs-grid">
          <Panel title="By environment" flush>
            <Table
              columns={[
                {
                  key: "env",
                  head: "env",
                  cell: (r) => <EnvChip env={r[0]} />,
                },
                { key: "n", head: "count", w: "70px", cell: (r) => r[1] },
              ]}
              rows={byEnv}
              rowKey={(r) => r[0]}
            />
          </Panel>

          <Panel title="By team" flush>
            <Table
              columns={[
                { key: "team", head: "team", cell: (r) => r[0] },
                { key: "n", head: "count", w: "70px", cell: (r) => r[1] },
              ]}
              rows={byTeam}
              rowKey={(r) => r[0]}
            />
          </Panel>

          <Panel title="POST /services">
            <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
              Registration is a write, so the console does not do it for you.
              Run it from your deploy pipeline:
            </p>
            <pre
              className="ct-mono"
              style={{
                marginTop: ".8rem",
                padding: ".7rem",
                border: "1px solid var(--line)",
                background: "var(--ink)",
                overflowX: "auto",
                fontSize: 10.5,
                lineHeight: 1.7,
                color: "var(--fg-3)",
              }}
            >
              {REGISTER_EXAMPLE}
            </pre>
          </Panel>
        </div>
      </div>

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
