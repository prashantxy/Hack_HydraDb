"use client";

import { useCallback, useMemo, useState } from "react";

import { api, type Typosquat } from "@/lib/api";
import { demoTyposquat } from "@/lib/demo";
import { useApi } from "@/lib/use-api";
import { PageHead } from "@/components/console/shell";
import {
  Panel,
  PopularityChip,
  QueryBar,
  RawJson,
  SourceBadge,
  Stat,
  Table,
} from "@/components/console/ui";

/*
 * GET /typosquat/:packageName?threshold=1..5
 *
 * Levenshtein distance over every Package name in the graph. Edit
 * distance alone is noisy — a shared prefix or suffix is what turns a
 * near-miss into a plausible squat — so those signals get their own
 * columns rather than being folded into one number.
 */

export default function TyposquatPage() {
  const [name, setName] = useState("express");
  const [threshold, setThreshold] = useState(2);
  const [query, setQuery] = useState({ name: "express", threshold: 2 });

  const load = useCallback(
    (signal: AbortSignal) =>
      api.typosquat(query.name, query.threshold, signal),
    [query],
  );
  const fallback = useCallback(
    () => demoTyposquat(query.name, query.threshold),
    [query],
  );

  const { data, error, source, loading, reload } = useApi<Typosquat>(
    `typosquat:${query.name}:${query.threshold}`,
    load,
    fallback,
  );

  const candidates = useMemo(
    () =>
      [...(data?.candidates ?? [])].sort(
        (a, b) =>
          a.editDistance - b.editDistance ||
          Number(b.sharedPrefix) - Number(a.sharedPrefix) ||
          a.packageName.localeCompare(b.packageName),
      ),
    [data],
  );

  /* a squat that shares both ends of the name is the one to look at */
  const closest = candidates.filter(
    (c) => c.editDistance === 1 || (c.sharedPrefix && c.sharedSuffix),
  ).length;

  const run = () =>
    setQuery({ name: name.trim() || "express", threshold });

  return (
    <>
      <PageHead
        eyebrow="Typosquat"
        title="Names close enough to be mistaken"
        lede="Edit distance across every package name the graph holds. One transposed character in an install command is the whole attack, so proximity plus a shared prefix is the signal worth acting on."
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
            id: "name",
            label: "package name",
            value: name,
            onChange: setName,
            placeholder: "express",
          },
        ]}
        depth={threshold}
        onDepth={setThreshold}
        depthLabel="edit distance"
        onSubmit={run}
      />

      <div className="cs-stats">
        <Stat label="Target" value={data?.targetPackage ?? "—"} />
        <Stat label="Candidates" value={candidates.length} tone="hot" />
        <Stat
          label="Distance 1 or both ends"
          value={closest}
          hint="the ones worth a look"
        />
        <Stat label="Threshold" value={data?.threshold ?? query.threshold} />
      </div>

      <Panel
        title={`GET /typosquat/${query.name}?threshold=${query.threshold}`}
        meta={`${candidates.length} within distance ${query.threshold}`}
        flush
      >
        <Table
          columns={[
            { key: "name", head: "package", cell: (c) => c.packageName },
            {
              key: "dist",
              head: "distance",
              w: "80px",
              cell: (c) => (
                <span
                  style={{
                    color:
                      c.editDistance === 1 ? "var(--crit)" : "var(--fg-2)",
                  }}
                >
                  {c.editDistance}
                </span>
              ),
            },
            {
              key: "ends",
              head: "shared",
              w: "120px",
              cell: (c) =>
                [c.sharedPrefix ? "prefix" : null, c.sharedSuffix ? "suffix" : null]
                  .filter(Boolean)
                  .join(" + ") || "—",
            },
            {
              key: "pop",
              head: "popularity",
              w: "110px",
              cell: (c) => <PopularityChip value={c.popularity} />,
            },
            { key: "signal", head: "risk signal", cell: (c) => c.riskSignal },
          ]}
          rows={candidates}
          rowKey={(c) => c.packageName}
          empty={
            loading
              ? "querying…"
              : `No package name is within ${query.threshold} edits of "${query.name}".`
          }
        />
      </Panel>

      <Panel title="Response" flush>
        <RawJson data={data} />
      </Panel>
    </>
  );
}
