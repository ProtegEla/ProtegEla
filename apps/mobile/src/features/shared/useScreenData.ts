import { useCallback, useMemo } from "react";

import {
  emergencyService,
  safetyGuidesService,
  supportLocationsService,
} from "../../services/api/catalogs";

import { secureStore } from "../../storage/secureStore";
import { useApiResource } from "./useApiResource";

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
  coordinates: Coordinates | null,
) {
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (latitude == null || longitude == null) return [];

      return supportLocationsService.getNearby(
        { latitude, longitude },
        { signal },
      );
    },
    [latitude, longitude],
  );

  const resource = useApiResource(load);

  const stations = useMemo(
    () =>
      (resource.data ?? []).map((item) => ({
        id: item.id,
        name: item.name?.trim() || "Local de apoio",
        address:
          `Coordenadas: ${item.latitude.toFixed(5)}, ` +
          item.longitude.toFixed(5),
        distanceLabel:
          item.distance_m < 1000
            ? `${Math.round(item.distance_m)} m`
            : `${(item.distance_m / 1000)
                .toFixed(1)
                .replace(".", ",")} km`,
        location: {
          latitude: item.latitude,
          longitude: item.longitude,
        },
      })),
    [resource.data],
  );

  const locations = useMemo(
    () =>
      (resource.data ?? []).map((item) => ({
        id: item.id,
        name: item.name?.trim() || "Local de apoio",
        latitude: item.latitude,
        longitude: item.longitude,
        distance_meters: item.distance_m,
      })),
    [resource.data],
  );

  return {
    ...resource,
    stations,
    locations,
    hasLocation: latitude != null && longitude != null,
  };
}

export function useEmergencyTarget(
  authRevision: unknown = null,
) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const token = await secureStore.getAccessToken();

      // Contingência prevista para acesso sem login.
      if (!token?.trim()) {
        return {
          phone: "190",
          label: "Polícia Militar",
        };
      }

      const result =
        await emergencyService.getCallTarget({ signal });

      const phone = result.phone.trim();

      if (!phone) {
        throw new Error(
          "O servidor não informou o telefone de emergência.",
        );
      }

      return {
        phone,
        label:
          phone === "190"
            ? "Polícia Militar"
            : "Contato de emergência",
      };
    },
    [authRevision],
  );

  const resource = useApiResource(load);

  return {
    ...resource,
    target: resource.data,
  };
}