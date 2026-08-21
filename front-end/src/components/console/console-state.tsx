"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { versionKey, type Ecosystem } from "@/lib/api";
import type { Source } from "@/lib/use-api";

/*
 * Two pieces of console-wide state.
 *
 * Target: the thing you are asking about. Every view asks the same
 * question of a different endpoint, so typing the package again on
 * each page was pure friction — set it once and every page follows.
 * Persisted so a reload does not lose your place.
 *
 * Status: whether the data on screen came from the API or the sample
 * set. One indicator in the top bar owns this; pages report into it
 * rather than each printing their own badge.
 */

export interface Target {
  ecosystem: Ecosystem;
  name: string;
  version: string;
  depth: number;
}

const DEFAULT_TARGET: Target = {
  ecosystem: "npm",
  name: "axios",
  version: "1.7.2",
  depth: 3,
};

const STORAGE_KEY = "chaintrace.console.target";

interface TargetValue {
  target: Target;
  /* the version key the API wants, e.g. npm:axios@1.7.2 */
  key: string;
  setTarget: (patch: Partial<Target>) => void;
  reset: () => void;
}

const TargetContext = createContext<TargetValue | null>(null);

/* ── status ──────────────────────────────────────────────────── */

export type Health = "checking" | "live" | "offline";

interface StatusValue {
  source: Source;
  error: string | null;
  /* bumped to make every page refetch */
  nonce: number;
  report: (source: Source, error: string | null) => void;
  refresh: () => void;
}

const StatusContext = createContext<StatusValue | null>(null);

export function ConsoleState({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<Target>(DEFAULT_TARGET);
  const [source, setSource] = useState<Source>("live");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  /* restore after mount rather than during render, so the server and
   * client agree on the first paint */
  useEffect(() => {
    let raf = 0;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Target>;
      raf = requestAnimationFrame(() =>
        setTargetState((t) => ({
        ecosystem: saved.ecosystem === "pypi" ? "pypi" : t.ecosystem,
        name: typeof saved.name === "string" && saved.name ? saved.name : t.name,
        version:
          typeof saved.version === "string" && saved.version
            ? saved.version
            : t.version,
        depth:
          typeof saved.depth === "number" && saved.depth >= 1 && saved.depth <= 5
              ? saved.depth
              : t.depth,
        })),
      );
    } catch {
      /* corrupt or unavailable storage is not worth surfacing */
    }

    return () => cancelAnimationFrame(raf);
  }, []);

  const setTarget = useCallback((patch: Partial<Target>) => {
    setTargetState((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode, quota — the in-memory value still works */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setTargetState(DEFAULT_TARGET);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  const report = useCallback((s: Source, e: string | null) => {
    setSource(s);
    setError(e);
  }, []);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const targetValue = useMemo<TargetValue>(
    () => ({
      target,
      key: versionKey(target.name, target.version, target.ecosystem),
      setTarget,
      reset,
    }),
    [target, setTarget, reset],
  );

  const statusValue = useMemo<StatusValue>(
    () => ({ source, error, nonce, report, refresh }),
    [source, error, nonce, report, refresh],
  );

  return (
    <TargetContext.Provider value={targetValue}>
      <StatusContext.Provider value={statusValue}>
        {children}
      </StatusContext.Provider>
    </TargetContext.Provider>
  );
}

export function useTarget() {
  const ctx = useContext(TargetContext);
  if (!ctx) throw new Error("useTarget must be used inside ConsoleState");
  return ctx;
}

export function useStatus() {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error("useStatus must be used inside ConsoleState");
  return ctx;
}

/* Pages call this with whatever useApi last returned, so the single
 * top-bar indicator always describes what is actually on screen. */
export function useReportSource(source: Source, error: string | null) {
  const { report } = useStatus();

  useEffect(() => {
    const raf = requestAnimationFrame(() => report(source, error));
    return () => cancelAnimationFrame(raf);
  }, [report, source, error]);
}
