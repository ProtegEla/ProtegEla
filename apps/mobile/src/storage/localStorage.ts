import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "@protegela:device_id";
const CACHED_ROUTE_KEY = "@protegela:cached_last_route";
const CACHED_RISK_ZONES_KEY = "@protegela:cached_risk_zones";

/**
 * Utilitário de persistência local não-sensível para resiliência offline (RNF03).
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
};
