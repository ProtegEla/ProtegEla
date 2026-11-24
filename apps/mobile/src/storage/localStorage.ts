import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "@protegela:device_id";
const CACHED_ROUTE_KEY = "@protegela:cached_last_route";
const CACHED_RISK_ZONES_KEY = "@protegela:cached_risk_zones";
const CACHED_SUPPORT_LOCATIONS_KEY = "@protegela:cached_support_locations";
const CACHED_RECENT_SEARCHES_KEY = "@protegela:cached_recent_searches";

export interface StoredRecentSearch {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

/**
 * Utilitário de persistência local não-sensível para resiliência offline (RNF03, RNF10).
 */
export const localStorage = {
  /**
   * Obtém ou inicializa o identificador persistente do dispositivo para acesso sem login (RF04).
   */
  async getOrCreateDeviceId(): Promise<string> {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const newId = "dev-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  },

  async cacheSupportLocations(locations: unknown): Promise<void> {
    await AsyncStorage.setItem(CACHED_SUPPORT_LOCATIONS_KEY, JSON.stringify(locations));
  },

  async getCachedSupportLocations<T>(): Promise<T | null> {
    const data = await AsyncStorage.getItem(CACHED_SUPPORT_LOCATIONS_KEY);
    return data ? (JSON.parse(data) as T) : null;
  },

  async cacheLastRoute(routeData: unknown): Promise<void> {
    await AsyncStorage.setItem(CACHED_ROUTE_KEY, JSON.stringify(routeData));
  },

  async getLastCachedRoute<T>(): Promise<T | null> {
    const data = await AsyncStorage.getItem(CACHED_ROUTE_KEY);
    return data ? (JSON.parse(data) as T) : null;
  },

  async cacheRiskZones(zonesData: unknown): Promise<void> {
    await AsyncStorage.setItem(CACHED_RISK_ZONES_KEY, JSON.stringify(zonesData));
  },

  async getCachedRiskZones<T>(): Promise<T | null> {
    const data = await AsyncStorage.getItem(CACHED_RISK_ZONES_KEY);
    return data ? (JSON.parse(data) as T) : null;
  },

  /**
   * Salva uma busca recente no histórico local do dispositivo (RF04).
   * Mantém no máximo 10 buscas recentes, ordenadas da mais recente para a mais antiga.
   */
  async saveRecentSearch(search: {
    id: string;
    label: string;
    title?: string;
    subtitle?: string;
    latitude: number;
    longitude: number;
  }): Promise<void> {
    try {
      const existing = await this.getRecentSearches();
      // Remove se já existir com o mesmo id ou coordenadas aproximadas
      const filtered = existing.filter(
        (item) =>
          item.id !== search.id &&
          !(
            Math.abs(item.latitude - search.latitude) < 0.0001 &&
            Math.abs(item.longitude - search.longitude) < 0.0001
          )
      );

      // Extrai title e subtitle caso não tenham sido passados
      const parts = search.label.split(",").map((s) => s.trim());
      const title = search.title || parts[0] || search.label;
      const subtitle = search.subtitle || parts.slice(1).join(", ") || "";

      const newItem: StoredRecentSearch = {
        id: search.id,
        label: search.label,
        title,
        subtitle,
        latitude: search.latitude,
        longitude: search.longitude,
        timestamp: Date.now(),
      };

      const updated = [newItem, ...filtered].slice(0, 10);
      await AsyncStorage.setItem(CACHED_RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignora falha de escrita local
    }
  },

  /**
   * Retorna a lista de buscas recentes salvas no dispositivo.
   */
  async getRecentSearches(): Promise<StoredRecentSearch[]> {
    try {
      const data = await AsyncStorage.getItem(CACHED_RECENT_SEARCHES_KEY);
      return data ? (JSON.parse(data) as StoredRecentSearch[]) : [];
    } catch {
      return [];
    }
  },

  /**
   * Limpa o histórico de buscas recentes.
   */
  async clearRecentSearches(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHED_RECENT_SEARCHES_KEY);
    } catch {
      // Ignora erro
    }
  },
};
