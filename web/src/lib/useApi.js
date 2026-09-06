import { useCallback, useEffect, useRef, useState } from 'react';

// Small data-fetching hook. Every screen needs the same three states — loading,
// error, data — and a way to refetch after a mutation.
//
// The distinction that matters here is between a *first* load and a *re*-load.
// A skeleton is the right answer for a screen with nothing on it yet. It is the
// wrong answer for a screen that already has content and is checking for newer
// content: closing the document viewer used to blank the entire library back to
// shimmer bars and rebuild it, which reads as a page reload rather than as a
// refresh. So `loading` now means "there is nothing to show yet" and stays
// false for the rest of the screen's life; `refreshing` covers everything
// after, and the old data stays on screen until the new data replaces it.
export function useApi(fetcher, deps = [], { skip = false } = {}) {
  const [data, setDataState] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on every successful fetch. A caller can use it to re-run an
  // entrance animation without remounting anything — see `Refreshed`.
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);
  // Whether anything has ever arrived. A ref, not `data`, so `run` does not
  // have to list the data it is about to replace among its own dependencies.
  const settled = useRef(false);

  // The body must re-arm the ref, not just the cleanup disarm it. StrictMode
  // runs effects mount -> unmount -> mount in development, so a cleanup-only
  // effect leaves this false forever after the first double-invoke, every
  // setState below is skipped, and the screen shimmers on a skeleton that
  // never resolves even though the request succeeded.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const setData = useCallback((next) => {
    settled.current = true;
    setDataState(next);
  }, []);

  const run = useCallback(async () => {
    if (skip) { setLoading(false); return; }
    if (settled.current) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mounted.current) {
        settled.current = true;
        setDataState(result);
        setVersion((v) => v + 1);
      }
    } catch (err) {
      if (mounted.current) setError(err.message ?? 'Something went wrong');
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  useEffect(() => { run(); }, [run]);

  return { data, error, loading, refreshing, version, refetch: run, setData };
}
