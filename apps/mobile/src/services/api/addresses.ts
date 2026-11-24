import axios from "axios";
import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface AddressSuggestion {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface AddressSuggestionsResponse {
  data: AddressSuggestion[];
}

/**
 * Endereços de referência em São Paulo para contingência offline.
 */
const FALLBACK_SP_ADDRESSES: AddressSuggestion[] = [
  {
    id: "sp-paulista",
    label: "Avenida Paulista, Bela Vista, São Paulo - SP",
    latitude: -23.5615,
    longitude: -46.6559,
  },
  {
    id: "sp-se",
    label: "Praça da Sé, Centro Histórico de São Paulo, São Paulo - SP",
    latitude: -23.5505,
    longitude: -46.6333,
  },
  {
    id: "sp-augusta",
    label: "Rua Augusta, Consolação, São Paulo - SP",
    latitude: -23.5532,
    longitude: -46.6548,
  },
  {
    id: "sp-consolacao",
    label: "Rua da Consolação, Centro, São Paulo - SP",
    latitude: -23.5489,
    longitude: -46.6453,
  },
  {
    id: "sp-faria-lima",
    label: "Avenida Brigadeiro Faria Lima, Pinheiros, São Paulo - SP",
    latitude: -23.5714,
    longitude: -46.6892,
  },
  {
    id: "sp-liberdade",
    label: "Praça da Liberdade, Liberdade, São Paulo - SP",
    latitude: -23.5553,
    longitude: -46.6358,
  },
  {
    id: "sp-republica",
    label: "Praça da República, República, São Paulo - SP",
    latitude: -23.5432,
    longitude: -46.6428,
  },
  {
    id: "sp-vila-madalena",
    label: "Rua Harmonia, Vila Madalena, São Paulo - SP",
    latitude: -23.5539,
    longitude: -46.6917,
  },
];

export const addressService = {
  /**
   * Consulta sugestões de endereço a partir de 3 caracteres.
   * 1º: Tenta o backend oficial (/addresses/suggestions via OpenRouteService).
   * 2º: Se o backend retornar 503 (chave do ORS em mock_dev_key), consulta diretamente a API pública
   *     e gratuita do OpenStreetMap Nominatim (que funciona para todo o Brasil, incluindo qualquer cidade).
   * 3º: Se estiver sem internet, usa a lista offline de pontos de referência.
   */
  async getSuggestions(query: string, limit = 5): Promise<AddressSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      return [];
    }

    // 1º: Tenta backend oficial
    try {
      const response = await apiClient.get<AddressSuggestionsResponse>(
        ENDPOINTS.ADDRESSES.SUGGESTIONS,
        {
          params: {
            q: trimmed,
            limit,
          },
        }
      );

      if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        return response.data.data;
      }
    } catch (err: any) {
      // Backend com OPENROUTESERVICE_API_KEY=mock_dev_key (503) ou offline
    }

    // 2º: Contingência inteligente via OpenStreetMap Nominatim (gratuita e pública)
    try {
      const nominatimRes = await axios.get<any[]>(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: trimmed,
            format: "json",
            limit,
            countrycodes: "br",
          },
          headers: {
            Accept: "application/json",
          },
          timeout: 4000,
        }
      );

      if (nominatimRes.data && Array.isArray(nominatimRes.data) && nominatimRes.data.length > 0) {
        return nominatimRes.data.map((item) => ({
          id: String(item.place_id),
          label: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }));
      }
    } catch {
      // Ignora erro do Nominatim e tenta base offline
    }

    // 3º: Base local offline
    const lower = trimmed.toLowerCase();
    const filtered = FALLBACK_SP_ADDRESSES.filter((item) =>
      item.label.toLowerCase().includes(lower)
    );

    return filtered.slice(0, limit);
  },
};
