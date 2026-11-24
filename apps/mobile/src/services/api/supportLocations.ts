import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import { SupportLocation } from "../../features/map/types";
import { localStorage } from "../../storage/localStorage";

export interface NearbySupportLocationsParams {
  latitude: number;
  longitude: number;
  radius_meters?: number;
}

export interface BackendSupportLocationItem {
  id: string;
  name?: string | null;
  latitude: number;
  longitude: number;
  distance_m?: number;
}

export interface BackendSupportLocationsResponse {
  data: BackendSupportLocationItem[];
}

/**
 * Calcula distância geodésica em metros entre duas coordenadas (Haversine).
 */
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const supportLocationsService = {
  /**
   * Busca delegacias e pontos de apoio próximos da coordenada informada.
   * Salva no cache do dispositivo (AsyncStorage) quando carregar com sucesso.
   * Calcula a distância localmente por Haversine — sem chamadas extras de API.
   */
  async getNearby(params: NearbySupportLocationsParams): Promise<SupportLocation[]> {
    try {
      const response = await apiClient.get<BackendSupportLocationsResponse | SupportLocation[]>(
        ENDPOINTS.SUPPORT_LOCATIONS.NEARBY,
        {
          params: {
            latitude: params.latitude,
            longitude: params.longitude,
            radius: params.radius_meters || 5000,
          },
        }
      );

      // Normaliza se a resposta vier encapsulada em { data: [...] } ou lista direta
      const rawList = Array.isArray(response.data)
        ? response.data
        : (response.data as BackendSupportLocationsResponse)?.data || [];

      if (rawList.length > 0) {
        const mappedList: SupportLocation[] = rawList.map((item: any) => ({
          id: String(item.id),
          name: item.name || "Delegacia de Polícia",
          type: "police",
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          distance_meters: Math.round(
            haversineDistanceMeters(
              params.latitude,
              params.longitude,
              Number(item.latitude),
              Number(item.longitude),
            )
          ),
        }));

        // Ordena pela distância calculada localmente
        mappedList.sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));

        // Salva no cache do próprio dispositivo do usuário
        await localStorage.cacheSupportLocations(mappedList);
        return mappedList;
      }

      // Se a API retornar lista vazia, tenta o cache do dispositivo ou retorna vazio
      const cached = await localStorage.getCachedSupportLocations<SupportLocation[]>();
      return cached || [];
    } catch (error) {
      // Lê do cache persistido anteriormente pelo próprio aparelho
      const cached = await localStorage.getCachedSupportLocations<SupportLocation[]>();
      if (cached && cached.length > 0) {
        return cached;
      }
      return [];
    }
  },
};
