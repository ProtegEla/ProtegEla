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

export const supportLocationsService = {
  /**
   * Busca delegacias e pontos de apoio próximos da coordenada informada.
   * Salva no cache do dispositivo (AsyncStorage) quando carregar com sucesso.
   * Se a API estiver offline, lê exclusivamente do cache do próprio aparelho (sem mock estático).
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
          distance_meters: item.distance_m ?? item.distance_meters,
        }));

        // Salva no cache do próprio dispositivo do usuário
        await localStorage.cacheSupportLocations(mappedList);
        return mappedList;
      }

      // Se a API retornar lista vazia, tenta o cache do dispositivo
      const cached = await localStorage.getCachedSupportLocations<SupportLocation[]>();
      return cached || [];
    } catch (error) {
      console.warn("Backend indisponível. Consultando cache local do dispositivo:", error);
      // Lê do cache persistido anteriormente pelo próprio aparelho
      const cached = await localStorage.getCachedSupportLocations<SupportLocation[]>();
      return cached || [];
    }
  },
};

