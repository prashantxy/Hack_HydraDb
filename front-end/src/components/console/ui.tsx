"use client";

import { useState, type ReactNode } from "react";
import {
  API_BASE,
  ECOSYSTEMS,
  type Ecosystem,
  type Popularity,
  type Severity,
} from "@/lib/api";
import { depthHex } from "@/lib/layout3d";
import type { Source } from "@/lib/use-api";
import { PixelArrow, Ticks } from "@/components/site/primitives";

/* ── panel ───────────────────────────────────────────────────── */

export function Panel({
  title,
  meta,
  children,
  flush,
  className = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`cs-panel ${className}`.trim()}>
      <Ticks />
      {title && (
        <header className="cs-panel-head">
          <span>{title}</span>
          {meta && <span className="cs-panel-meta">{meta}</span>}
        </header>
      )}
      <div className={flush ? "" : "cs-panel-body"}>{children}</div>
    </section>
  );
}

/* ── data source badge ───────────────────────────────────────── */

export function SourceBadge({
  source,
  error,
  loading,
  onReload,
}: {
  source: Source;
  error: string | null;
  loading: boolean;
  onReload?: () => void;
}) {
  const host = API_BASE.replace(/^https?:\/\//, "");

  return (
    <div className={`cs-source is-${source}`}>
      <i className={loading ? "cs-dot cs-dot-pulse" : "cs-dot"} aria-hidden />
      <span>
        {loading
          ? `querying ${host}`
          : source === "live"
            ? `live · ${host}`
            : `sample data · ${error ?? "api unreachable"}`}
      </span>
      {onReload && (
        <button type="button" className="cs-mini-btn" onClick={onReload}>
          retry
        </button>
      )}
    </div>
  );
}

/* ── severity ────────────────────────────────────────────────── */

export function SeverityChip({ value }: { value: Severity }) {
  return <span className={`cs-sev cs-sev-${value}`}>{value}</span>;
}

export function EnvChip({ env }: { env: string | null }) {
  const e = (env ?? "unknown").toLowerCase();
  return <span className={`cs-env cs-env-${e}`}>{e}</span>;
}

/* ── table ───────────────────────────────────────────────────── */

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  activeKey,
  empty = "No rows",
}: {
  columns: { key: string; head: ReactNode; cell: (row: T) => ReactNode; w?: string }[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  activeKey?: string | null;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="cs-empty">{empty}</p>;
  }

  return (
    <div className="cs-table-wrap">
      <table className="cs-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.w ? { width: c.w } : undefined}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row);
            return (
              <tr
                key={k}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  onRowClick ? "is-clickable" : "",
                  activeKey === k ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.cell(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── stat tile ───────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "hot" | "plain";
}) {
  return (
    <div className="cs-stat">
      <span className="cs-stat-label">{label}</span>
      <span className={`cs-stat-value ${tone === "hot" ? "is-hot" : ""}`}>
        {value}
      </span>
      {hint && <span className="cs-stat-hint">{hint}</span>}
    </div>
  );
}

/* ── depth dial ──────────────────────────────────────────────── */

export function DepthDial({
  value,
  onChange,
  max = 5,
  label = "depth",
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label?: string;
}) {
  return (
    <div className="cs-dial" role="group" aria-label={`${label} (1 to ${max})`}>
      <span className="cs-dial-label">{label}</span>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`cs-dial-btn ${n === value ? "is-on" : ""}`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* ── ecosystem toggle ────────────────────────────────────────
 * The graph holds npm and PyPI side by side, distinguished only by
 * the version-key prefix, so every version-keyed query needs this.
 */

export function EcosystemPick({
  value,
  onChange,
}: {
  value: Ecosystem;
  onChange: (v: Ecosystem) => void;
}) {
  return (
    <div className="cs-dial" role="group" aria-label="Ecosystem">
      <span className="cs-dial-label">eco</span>
      {ECOSYSTEMS.map((e) => (
        <button
          key={e}
          type="button"
          className={`cs-dial-btn cs-dial-wide ${e === value ? "is-on" : ""}`}
          aria-pressed={e === value}
          onClick={() => onChange(e)}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function PopularityChip({ value }: { value: Popularity }) {
  return <span className={`cs-pop cs-pop-${value}`}>{value}</span>;
}

/* ── query bar ───────────────────────────────────────────────── */

export function QueryBar({
  fields,
  depth,
  onDepth,
  onSubmit,
  maxDepth = 5,
  depthLabel = "depth",
  ecosystem,
  onEcosystem,
  submitLabel = "Run",
  children,
}: {
  fields: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    width?: string;
  }[];
  depth?: number;
  onDepth?: (v: number) => void;
  onSubmit: () => void;
  maxDepth?: number;
  depthLabel?: string;
  ecosystem?: Ecosystem;
  onEcosystem?: (v: Ecosystem) => void;
  submitLabel?: string;
  children?: ReactNode;
}) {
  return (
    <form
      className="cs-query"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {ecosystem && onEcosystem && (
        <EcosystemPick value={ecosystem} onChange={onEcosystem} />
      )}

      {fields.map((f) => (
        <label key={f.id} className="cs-field" style={{ width: f.width }}>
          <span>{f.label}</span>
          <input
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
      ))}

      {depth !== undefined && onDepth && (
        <DepthDial
          value={depth}
          onChange={onDepth}
          max={maxDepth}
          label={depthLabel}
        />
      )}

      <button type="submit" className="ct-btn cs-run">
        {submitLabel}
        <PixelArrow />
      </button>

      {children}
    </form>
  );
}

/* ── depth legend ────────────────────────────────────────────── */

export function DepthLegend({ max }: { max: number }) {
  return (
    <div className="cs-legend">
      {Array.from({ length: max + 1 }, (_, d) => (
        <span key={d} className="cs-legend-item">
          <i style={{ background: depthHex(d) }} aria-hidden />
          hop {d}
        </span>
      ))}
    </div>
  );
}

/* ── score gauge ─────────────────────────────────────────────── */

export function Gauge({
  score,
  severity,
}: {
  score: number;
  severity: Severity;
}) {
  const R = 54;
  const CIRC = Math.PI * R; // half circle
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = `var(--${severity === "CRITICAL" ? "crit" : severity === "HIGH" ? "high" : severity === "MEDIUM" ? "med" : "low"})`;

  return (
    <div className="cs-gauge">
      <svg viewBox="0 0 140 82" aria-hidden>
        <path
          d={`M 16 70 A ${R} ${R} 0 0 1 124 70`}
          fill="none"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="9"
          strokeLinecap="butt"
        />
        <path
          d={`M 16 70 A ${R} ${R} 0 0 1 124 70`}
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="butt"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: "stroke-dashoffset .7s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="cs-gauge-read">
        <b>{score}</b>
        <span>/100</span>
      </div>
      <SeverityChip value={severity} />
    </div>
  );
}

/* ── version key helpers ─────────────────────────────────────── */

export function VersionKey({ value }: { value: string }) {
  const at = value.lastIndexOf("@");
  if (at <= 0) return <code className="cs-key">{value}</code>;
  return (
    <code className="cs-key">
      {value.slice(0, at)}
      <em>{value.slice(at)}</em>
    </code>
  );
}

/* ── collapsible raw response ────────────────────────────────── */

export function RawJson({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="cs-raw">
      <button
        type="button"
        className="cs-mini-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? "hide" : "show"} raw response
      </button>
      {open && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
