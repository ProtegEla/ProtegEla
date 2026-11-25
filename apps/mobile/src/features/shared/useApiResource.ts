import { useCallback, useEffect, useState } from "react";
import { normalizeApiError } from "../../services/api/client";

export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");
    setData(null);

    load(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(normalizeApiError(failure).message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [load, revision]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  return { data, loading, error, refresh };
}