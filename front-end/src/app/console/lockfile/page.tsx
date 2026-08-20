"use client";

import { useCallback, useMemo, useState } from "react";

import {
  api,
  versionKey,
  type Ecosystem,
  type LockfileEntry,
  type LockfileResolve,
} from "@/lib/api";
import { demoLockfileResolve } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { PageHead } from "@/components/console/shell";
import {
  EnvChip,
  Panel,
  QueryBar,
  RawJson,
  SourceBadge,
  Stat,
  Table,
  VersionKey,
} from "@/components/console/ui";

/*
 * POST /lockfiles/resolve
 *
 * Answers the question you get after an advisory lands: while that
 * version was live, which of our lockfiles actually resolved to it?
 * Ranges do not tell you — only the resolved entry does, so this
 * takes the pinned lines and checks each one against the graph.
 */

const SAMPLE = `http-errors 2.0.0
express 4.19.2
body-parser 1.20.2
lodash 4.17.21
requests==2.32.3`;

/* Lockfiles come in enough shapes that a tolerant line parser beats
 * asking people to reformat: name@version, name version, name==version
 * (pip), and "name": "version" (json) all land here. */
function parseEntries(text: string): {
  entries: LockfileEntry[];
  skipped: string[];
} {
  const entries: LockfileEntry[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  const PATTERNS = [
    /^"?([@\w][\w@./-]*?)"?\s*(?:==|:=|:|=)\s*"?v?([\w][\w.+-]*)"?,?$/,
    /^([@\w][\w@./-]*?)@(?:npm:)?v?([\w][\w.+-]*)$/,
    /^([@\w][\w@./-]*?)[ \t]+v?([\w][\w.+-]*)$/,
  ];

  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/[,;]$/, "");
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    let hit: LockfileEntry | null = null;

    for (const re of PATTERNS) {
      const m = line.match(re);
      if (m) {
        hit = { name: m[1], version: m[2] };
        break;
      }
    }

    if (!hit) {
      skipped.push(line);
      continue;
    }

    const dedupe = `${hit.name}@${hit.version}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    entries.push(hit);
  }

  return { entries, skipped };
}

export default function LockfilePage() {
  const [ecosystem, setEcosystem] = useState<Ecosystem>("npm");
  const [pkg, setPkg] = useState("http-errors");
  const [version, setVersion] = useState("2.0.0");
  const [text, setText] = useState(SAMPLE);

  const parsed = useMemo(() => parseEntries(text), [text]);

  const [query, setQuery] = useState({
    key: versionKey("http-errors", "2.0.0", "npm"),
    entries: parseEntries(SAMPLE).entries,
  });

  const load = useCallback(
    (signal: AbortSignal) =>
      api.lockfileResolve(query.key, query.entries, signal),
    [query],
  );
  const fallback = useCallback(
    () => demoLockfileResolve(query.key, query.entries),
    [query],
  );

  const { data, error, source, loading, reload } = useApi<LockfileResolve>(
    `lockfile:${query.key}:${query.entries.map((e) => `${e.name}@${e.version}`).join(",")}`,
    load,
    fallback,
  );

  /* the rows that matter: an entry reachable from a service whose tree
   * gets to the compromised version */
  const matches = useMemo(() => {
    const rows = data?.matches ?? [];
    return [...rows].sort(
      (a, b) =>
        b.services.length - a.services.length ||
        Number(b.inGraph) - Number(a.inGraph) ||
        a.name.localeCompare(b.name),
    );
  }, [data]);

  const run = () =>
    setQuery({
      key: versionKey(pkg.trim(), version.trim(), ecosystem),
      entries: parsed.entries,
    });

  return (
    <>
      <PageHead
        eyebrow="Lockfile resolve"
        title="Which lockfiles took the bad version"
        lede="Paste the pinned lines from a lockfile and each one is checked against the graph: does this exact version exist, and does anything a service ships reach the compromised version through it."
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
            label: "compromised package",
            value: pkg,
            onChange: setPkg,
            placeholder: "http-errors",
          },
          {
            id: "version",
            label: "version",
            value: version,
            onChange: setVersion,
            placeholder: "2.0.0",
          },
        ]}
        onSubmit={run}
        submitLabel="Resolve"
      >
        <span className="cs-stat-hint" style={{ alignSelf: "center" }}>
          against {parsed.entries.length} parsed{" "}
          {parsed.entries.length === 1 ? "entry" : "entries"}
        </span>
      </QueryBar>

      <div className="cs-stats">
        <Stat
          label="Entries checked"
          value={data?.checkedEntries ?? parsed.entries.length}
        />
        <Stat
          label="Resolved to compromised"
          value={data?.resolvedToCompromised ?? 0}
          tone="hot"
        />
        <Stat
          label="Known to the graph"
          value={matches.filter((m) => m.inGraph).length}
        />
        <Stat
          label="Unparsed lines"
          value={parsed.skipped.length}
          hint={parsed.skipped.length ? "ranges are ignored" : undefined}
        />
      </div>

      <div className="cs-grid cs-grid-main">
        <Panel
          title="POST /lockfiles/resolve"
          meta={`${matches.length} results`}
          flush
        >
          <Table
            columns={[
              { key: "name", head: "package", cell: (m) => m.name },
              { key: "v", head: "version", cell: (m) => m.version },
              {
                key: "graph",
                head: "in graph",
                w: "88px",
                cell: (m) => (
                  <span
                    style={{
                      color: m.inGraph ? "var(--low)" : "var(--fg-4)",
                    }}
                  >
                    {m.inGraph ? "yes" : "no"}
                  </span>
                ),
              },
              {
                key: "svc",
                head: "reaching services",
                cell: (m) =>
                  m.services.length === 0 ? (
                    <span style={{ color: "var(--fg-4)" }}>—</span>
                  ) : (
                    <span
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: ".3rem .5rem",
                        alignItems: "center",
                      }}
                    >
                      {m.services.map((s) => (
                        <span
                          key={s.serviceName}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: ".35rem",
                          }}
                        >
                          <b style={{ fontWeight: 400, color: "var(--fg)" }}>
                            {s.serviceName}
                          </b>
                          <EnvChip env={s.environment} />
                          <span style={{ color: "var(--fg-4)" }}>
                            {s.hops}h
                          </span>
                        </span>
                      ))}
                    </span>
                  ),
              },
            ]}
            rows={matches}
            rowKey={(m) => `${m.name}@${m.version}`}
            empty={loading ? "resolving…" : "No entries to check."}
          />
        </Panel>

        <div className="cs-grid">
          <Panel title="Lockfile entries" meta={`${parsed.entries.length} parsed`}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={12}
              aria-label="Lockfile entries"
              style={{
                width: "100%",
                resize: "vertical",
                font: "12px/1.7 var(--font-jetbrains-mono), monospace",
                color: "var(--fg)",
                background: "var(--ink)",
                border: "1px solid var(--line-2)",
                padding: ".6rem",
              }}
            />
            <p
              style={{
                fontSize: 11.5,
                color: "var(--fg-3)",
                marginTop: ".7rem",
              }}
            >
              One per line. <code>name version</code>,{" "}
              <code>name@version</code>, <code>name==version</code> and{" "}
              <code>&quot;name&quot;: &quot;version&quot;</code> all parse.
              Ranges are skipped — only a resolved version answers this
              question.
            </p>

            {parsed.skipped.length > 0 && (
              <div style={{ marginTop: ".8rem" }}>
                <p
                  className="cs-stat-label"
                  style={{ marginBottom: ".4rem" }}
                >
                  Skipped
                </p>
                <ul className="cs-reasons">
                  {parsed.skipped.slice(0, 8).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="Compromised version">
            <dl className="cs-kv">
              <dt>key</dt>
              <dd>
                <VersionKey value={query.key} />
              </dd>
              <dt>package</dt>
              <dd>{data?.compromisedPackage ?? pkg}</dd>
            </dl>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--fg-3)",
                marginTop: ".9rem",
              }}
            >
              An entry counts as resolved to the compromise when a service
              reaches the bad version through it — so an entry can exist in the
              graph and still be harmless.
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
