import { useCallback, useEffect, useRef, useState } from 'react';

// Small data-fetching hook. Every screen needs the same three states — loading,
// error, data — and a way to refetch after a mutation.
export function useApi(fetcher, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const mounted = useRef(true);

  // The body must re-arm the ref, not just the cleanup disarm it. StrictMode
  // runs effects mount -> unmount -> mount in development, so a cleanup-only
  // effect leaves this false forever after the first double-invoke, every
  // setState below is skipped, and the screen shimmers on a skeleton that
  // never resolves even though the request succeeded.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async () => {
    if (skip) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mounted.current) setData(result);
    } catch (err) {
      if (mounted.current) setError(err.message ?? 'Something went wrong');
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  useEffect(() => { run(); }, [run]);

  return { data, error, loading, refetch: run, setData };
}
