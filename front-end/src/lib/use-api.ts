"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * Small fetch hook with an honest fallback: if the API cannot be
 * reached, the page renders the sample dataset and says so. Loading
 * is derived from "which key did we last resolve", so nothing calls
 * setState synchronously inside the effect.
 */

export type Source = "live" | "sample";

interface State<T> {
  key: string | null;
  data: T | null;
  error: string | null;
  source: Source;
}

export function useApi<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  fallback: () => T,
) {
  const [state, setState] = useState<State<T>>({
    key: null,
    data: null,
    error: null,
    source: "live",
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    load(ac.signal)
      .then((data) => {
        if (alive) setState({ key, data, error: null, source: "live" });
      })
      .catch((err: Error) => {
        if (!alive || err.name === "AbortError") return;
        setState({
          key,
          data: fallback(),
          error: err.message,
          source: "sample",
        });
      });

    return () => {
      alive = false;
      ac.abort();
    };
    // load/fallback are recreated per render by callers; key is the
    // real dependency, and nonce forces an explicit refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: state.data,
    error: state.error,
    source: state.source,
    loading: state.key !== key,
    reload,
  };
}
