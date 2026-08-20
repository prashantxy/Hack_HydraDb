"use client";

import { useCallback, useMemo, useState } from "react";

import {
  api,
  versionKey,
  type CoMaintainers,
  type Ecosystem,
} from "@/lib/api";
import { demoCoMaintainers } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { PageHead } from "@/components/console/shell";
import {
  Panel,
  QueryBar,
  RawJson,
  SourceBadge,
  Stat,
  Table,
  VersionKey,
} from "@/components/console/ui";

/*
 * GET /versions/:versionKey/co-maintainers
 *
 * Walks (m:Maintainer)-[:MAINTAINS]->(:Package) out from the queried
 * package. When an account is compromised the blast radius is not one
 * package, it is everything that account can publish — so this view
 * ranks by how many maintainers are shared, not by dependency depth.
 */

export default function MaintainersPage() {
  const [ecosystem, setEcosystem] = useState<Ecosystem>("npm");
  const [pkg, setPkg] = useState("http-errors");
  const [version, setVersion] = useState("2.0.0");
  const [query, setQuery] = useState({
    key: versionKey("http-errors", "2.0.0", "npm"),
  });

  const load = useCallback(
    (signal: AbortSignal) => api.coMaintainers(query.key, signal),
    [query],
  );
  const fallback = useCallback(() => demoCoMaintainers(query.key), [query]);

  const { data, error, source, loading, reload } = useApi<CoMaintainers>(
    `comaint:${query.key}`,
    load,
    fallback,
  );

  const packages = useMemo(
    () =>
      [...(data?.packages ?? [])].sort(
        (a, b) =>
          b.sharedCount - a.sharedCount ||
          a.packageName.localeCompare(b.packageName),
      ),
    [data],
  );

  /* every distinct account that can publish to any of these */
  const maintainers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of packages)
      for (const m of p.sharedMaintainers)
        counts.set(m, (counts.get(m) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [packages]);

  const run = () =>
    setQuery({ key: versionKey(pkg.trim(), version.trim(), ecosystem) });

  return (
    <>
      <PageHead
        eyebrow="Co-maintainers"
        title="What else that account can publish"
        lede="Packages sharing at least one maintainer with the queried version. A stolen publish token is not scoped to the package you noticed — it reaches everything the account owns."
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
          label="Co-maintained packages"
          value={data?.coMaintainerCount ?? 0}
          tone="hot"
        />
        <Stat label="Distinct accounts" value={maintainers.length} />
        <Stat
          label="Most shared"
          value={packages[0]?.sharedCount ?? "—"}
          hint={packages[0]?.packageName}
        />
        <Stat label="Version" value={<VersionKey value={query.key} />} />
      </div>

      <div className="cs-grid cs-grid-main">
        <Panel
          title={`GET /versions/${query.key}/co-maintainers`}
          meta={`${packages.length} packages`}
          flush
        >
          <Table
            columns={[
              { key: "pkg", head: "package", cell: (p) => p.packageName },
              {
                key: "shared",
                head: "shared",
                w: "76px",
                cell: (p) => p.sharedCount,
              },
              {
                key: "who",
                head: "maintainers",
                cell: (p) => (
                  <ul className="cs-reasons">
                    {p.sharedMaintainers.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
            rows={packages}
            rowKey={(p) => p.packageName}
            empty={
              loading
                ? "querying…"
                : "No package shares a maintainer with this version — or no Maintainer edges have been ingested yet."
            }
          />
        </Panel>

        <div className="cs-grid">
          <Panel title="Accounts by reach" flush>
            <Table
              columns={[
                { key: "m", head: "maintainer", cell: (r) => r[0] },
                {
                  key: "n",
                  head: "packages",
                  w: "88px",
                  cell: (r) => r[1],
                },
              ]}
              rows={maintainers}
              rowKey={(r) => r[0]}
              empty="No maintainers in the result."
            />
          </Panel>

          <Panel title="Where this comes from">
            <pre
              className="ct-mono"
              style={{
                padding: ".7rem",
                border: "1px solid var(--line)",
                borderLeft: "2px solid var(--sig)",
                background: "var(--ink)",
                color: "var(--fg-2)",
                fontSize: 10.5,
                lineHeight: 1.8,
                overflowX: "auto",
              }}
            >
              {`(pkg:Package)-[:HAS_VERSION]->(v:Version {key})
(m:Maintainer)-[:MAINTAINS]->(pkg)
(m)-[:MAINTAINS]->(other:Package)`}
            </pre>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--fg-3)",
                marginTop: ".8rem",
              }}
            >
              Maintainer edges are written during ingest, so this view is only
              as complete as what has been crawled.
            </p>
          </Panel>
        </div>
      </div>

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
