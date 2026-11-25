import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeApiError } from "../../services/api/client";

interface ApiResourceOptions {
  enabled?: boolean;
  timeoutMs?: number;
  preserveDataOnReload?: boolean;
}

export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  {
    enabled = true,
    timeoutMs = 15_000,
    preserveDataOnReload = false,
  }: ApiResourceOptions = {},
) {
  const [revision, setRevision] = useState(0);

  const request = useMemo(
    () => ({
      load,
      revision,
      enabled,
      timeoutMs,
      preserveDataOnReload,
    }),
    [load, revision, enabled, timeoutMs, preserveDataOnReload],
  );

  const [state, setState] = useState<{
    request: typeof request;
    data: T | null;
    loading: boolean;
    error: string;
  }>(() => ({
    request,
    data: null,
    loading: enabled,
    error: "",
  }));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let settled = false;

    if (!request.enabled) {
      setState({
        request,
        data: null,
        loading: false,
        error: "",
      });

      return () => {
        active = false;
        controller.abort();
      };
    }

    const keepPrevious = (previous: typeof state) =>
      request.preserveDataOnReload &&
      previous.request.load === request.load;

    setState(previous => ({
      request,
      data: keepPrevious(previous) ? previous.data : null,
      loading: true,
      error: "",
    }));

    const timer = setTimeout(() => {
      if (!active || settled) return;

      settled = true;

      setState(previous => ({
        request,
        data: keepPrevious(previous) ? previous.data : null,
        loading: false,
        error: "A consulta demorou mais que o esperado. Tente novamente.",
      }));

      controller.abort();
    }, request.timeoutMs);

    Promise.resolve()
      .then(() => {
        if (!active || settled) return undefined;
        return request.load(controller.signal);
      })
      .then(value => {
        if (!active || settled) return;

        settled = true;
        clearTimeout(timer);

        setState({
          request,
          data: value as T,
          loading: false,
          error: "",
        });
      })
      .catch(failure => {
        if (!active || settled) return;

        settled = true;
        clearTimeout(timer);

        setState(previous => ({
          request,
          data: keepPrevious(previous) ? previous.data : null,
          loading: false,
          error: normalizeApiError(failure).message,
        }));
      });

    return () => {
      active = false;
      settled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [request]);

  const current = state.request === request;

  const canKeepData =
    preserveDataOnReload && state.request.load === request.load;

  return {
    data: enabled && (current || canKeepData) ? state.data : null,
    loading: enabled && (!current || state.loading),
    error: enabled && current ? state.error : "",
    refresh: useCallback(() => {
      setRevision(value => value + 1);
    }, []),
  };
}