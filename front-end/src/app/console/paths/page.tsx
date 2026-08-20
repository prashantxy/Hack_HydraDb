"use client";

import { useCallback, useMemo, useState } from "react";

import {
  api,
  versionKey,
  type AttackPaths,
  type Ecosystem,
} from "@/lib/api";
import { stripEcosystem } from "@/lib/api";
import { demoAttackPaths } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { PageHead } from "@/components/console/shell";
import {
  EnvChip,
  Panel,
  QueryBar,
  RawJson,
  SourceBadge,
  Stat,
  VersionKey,
} from "@/components/console/ui";

/*
 * GET /versions/:versionKey/attack-path?depth=
 *
 * A path is a sequence, so this view stays flat on purpose: the 3D
 * scene is the right tool for a graph and the wrong one for an
 * ordered chain you need to read link by link.
 */

const short = stripEcosystem;

export default function PathsPage() {
  const [ecosystem, setEcosystem] = useState<Ecosystem>("npm");
  const [pkg, setPkg] = useState("http-errors");
  const [version, setVersion] = useState("2.0.0");
  const [depth, setDepth] = useState(5);
  const [query, setQuery] = useState({
    key: versionKey("http-errors", "2.0.0", "npm"),
    depth: 5,
  });
  const [envFilter, setEnvFilter] = useState<string>("all");

  const load = useCallback(
    (signal: AbortSignal) => api.attackPaths(query.key, query.depth, signal),
    [query],
  );
  const fallback = useCallback(
    () => demoAttackPaths(query.key, query.depth),
    [query],
  );

  const { data, error, source, loading, reload } = useApi<AttackPaths>(
    `paths:${query.key}:${query.depth}`,
    load,
    fallback,
  );

  const paths = useMemo(
    () =>
      [...(data?.attackPaths ?? [])].sort(
        (a, b) => a.hops - b.hops || a.serviceName.localeCompare(b.serviceName),
      ),
    [data],
  );

  const envs = useMemo(
    () => [
      "all",
      ...new Set(
        paths.map((p) => (p.environment ?? "unknown").toLowerCase()),
      ),
    ],
    [paths],
  );

  const shown =
    envFilter === "all"
      ? paths
      : paths.filter(
          (p) => (p.environment ?? "unknown").toLowerCase() === envFilter,
        );

  const shortest = paths.length ? Math.min(...paths.map((p) => p.hops)) : null;
  const longest = paths.length ? Math.max(...paths.map((p) => p.hops)) : null;

  const run = () =>
    setQuery({
      key: versionKey(pkg.trim(), version.trim(), ecosystem),
      depth,
    });

  return (
    <>
      <PageHead
        eyebrow="Attack paths"
        title="The chain, link by link"
        lede="Each row is one route from a service to the compromised version, in traversal order. This is the view you take to whoever owns the upgrade — a score nobody can audit is a score nobody acts on."
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
      />

      <div className="cs-stats">
        <Stat label="Paths" value={data?.affectedServices ?? 0} tone="hot" />
        <Stat
          label="Shortest"
          value={shortest === null ? "—" : `${shortest} hops`}
        />
        <Stat
          label="Longest"
          value={longest === null ? "—" : `${longest} hops`}
        />
        <Stat label="Target" value={<VersionKey value={query.key} />} />
      </div>

      <Panel
        title={`GET /versions/${query.key}/attack-path?depth=${query.depth}`}
        meta={
          <span style={{ display: "inline-flex", gap: ".4rem" }}>
            {envs.map((e) => (
              <button
                key={e}
                type="button"
                className="cs-mini-btn"
                style={
                  envFilter === e
                    ? { color: "var(--sig)", borderColor: "var(--sig)" }
                    : undefined
                }
                onClick={() => setEnvFilter(e)}
              >
                {e}
              </button>
            ))}
          </span>
        }
        flush
      >
        {shown.length === 0 ? (
          <p className="cs-empty">
            {loading
              ? "querying…"
              : "No path reaches this version from a registered service."}
          </p>
        ) : (
          shown.map((p) => (
            <article key={`${p.serviceId}-${p.path.join()}`} className="cs-chain">
              <header className="cs-chain-head">
                <span className="cs-chain-name">{p.serviceName}</span>
                <EnvChip env={p.environment} />
                <span className="cs-chain-hops">
                  {p.hops} hop{p.hops === 1 ? "" : "s"} · {p.path.length} link
                  {p.path.length === 1 ? "" : "s"}
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

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
