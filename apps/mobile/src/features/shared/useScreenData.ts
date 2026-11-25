import { useCallback, useMemo } from "react";

import {
  emergencyService,
  safetyGuidesService,
  supportLocationsService,
  type SupportLocationWithDistance,
} from "../../services/api/catalogs";

import { secureStore } from "../../storage/secureStore";
import { useApiResource } from "./useApiResource";

import { ApiError } from "../../services/api/client";
//import type { Coordinates } from "../../services/api/reportAdapters";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function useUsefulNumbers() {
  const load = useCallback(
    (signal: AbortSignal) =>
      emergencyService.getUsefulNumbers({ signal }),
    [],
  );

  const resource = useApiResource(load);

  return {
    ...resource,
    numbers: resource.data ?? [],
  };
}

export function useSafetyGuides() {
  const load = useCallback(async (signal: AbortSignal) => {
    const summaries =
      await safetyGuidesService.list({ signal });

    if (signal.aborted) return [];

    // A listagem tem resumo; o conteúdo completo vem pelo slug.
    const guides = await Promise.all(
      summaries.map((guide) =>
        safetyGuidesService.get(guide.slug, { signal }),
      ),
    );

    return guides.sort(
      (first, second) => first.position - second.position,
    );
  }, []);

  const resource = useApiResource(load);

  return {
    ...resource,
    guides: resource.data ?? [],
  };
}

export function useSupportLocations(
  coordinates: Readonly<Coordinates> | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  const load = useCallback(
    async (signal: AbortSignal): Promise<SupportLocationWithDistance[]> => {
      if (latitude == null || longitude == null) return [];

      return supportLocationsService.getNearby(
        { latitude, longitude },
        { signal },
      );
    },
    [latitude, longitude],
  );

  const resource = useApiResource(load, {
    enabled: enabled && latitude != null && longitude != null,
    timeoutMs: 15_000,
    preserveDataOnReload: true,
  });

  const stations = useMemo(
    () =>
      (resource.data ?? []).map(location => ({
        id: location.id,
        name: location.name?.trim() || "Local de apoio",
        address:
          `Coordenadas: ${location.latitude.toFixed(5)}, ` +
          location.longitude.toFixed(5),
        distanceLabel:
          location.distance_m < 1000
            ? `${Math.round(location.distance_m)} m`
            : `${(location.distance_m / 1000)
                .toFixed(1)
                .replace(".", ",")} km`,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      })),
    [resource.data],
  );

  const locations = useMemo(
    () =>
      (resource.data ?? []).map(location => ({
        id: location.id,
        name: location.name?.trim() || "Local de apoio",
        latitude: location.latitude,
        longitude: location.longitude,
        distance_meters: location.distance_m,
      })),
    [resource.data],
  );

  return {
    ...resource,
    stations,
    locations,
  };
}

export function useEmergencyTarget(
  sessionKey: unknown = null,
  {
    enabled = true,
    isLoggedIn,
  }: {
    enabled?: boolean;
    isLoggedIn?: boolean;
  } = {},
) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (isLoggedIn === false) {
        return {
          phone: "190",
          label: "Polícia Militar",
          source: "guest-fallback" as const,
        };
      }

      const token = await secureStore.getAccessToken();

      if (!token?.trim()) {
        if (isLoggedIn === true) {
          throw new ApiError(
            "Faça login novamente para continuar.",
            401,
            "UNAUTHORIZED",
          );
        }

        return {
          phone: "190",
          label: "Polícia Militar",
          source: "guest-fallback" as const,
        };
      }

      const response = await emergencyService.getCallTarget({ signal });
      const phone = response.phone.trim();

      if (!phone) {
        throw new Error(
          "O servidor não informou um telefone para a ligação.",
        );
      }

      return {
        phone,
        label:
          phone === "190"
            ? "Polícia Militar"
            : "Contato de emergência",
        source: "api" as const,
      };
    },
    [sessionKey, isLoggedIn],
  );

  const resource = useApiResource(load, {
    enabled,
    timeoutMs: 15_000,
  });

  return {
    ...resource,
    target: resource.data,
  };
}