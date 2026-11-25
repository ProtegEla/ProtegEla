import { useCallback, useEffect, useState } from "react";

import {
  riskZonesService,
  type Bounds,
} from "../../services/api/reports";

import { normalizeApiError } from "../../services/api/client";
import type { Schemas } from "../../services/api/contracts";

export function useRiskZones() {
  const [bounds, setBounds] = useState<Bounds | null>(null);

  const [features, setFeatures] = useState<
    Schemas["ZoneFeature"][]
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const key = bounds ? JSON.stringify(bounds) : "";

  useEffect(() => {
    if (!key) return;

    const controller = new AbortController();

    setFeatures([]);
    setLoading(true);
    setError("");

    const timer = setTimeout(() => {
      riskZonesService
        .list(JSON.parse(key) as Bounds, {
          signal: controller.signal,
        })
        .then((response) => {
          if (!controller.signal.aborted) {
            setFeatures(response.data.features);
          }
        })
        .catch((failure) => {
          if (!controller.signal.aborted) {
            setError(normalizeApiError(failure).message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, revision]);

  return {
    features,
    loading,
    error,

    onBoundsChange: useCallback(
      (next: Bounds) => setBounds(next),
      [],
    ),

    refresh: useCallback(
      () => setRevision((value) => value + 1),
      [],
    ),
  };
}