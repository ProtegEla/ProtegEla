import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Coordinates, SupportLocation } from "../features/map/types";
import type { DangerReport } from "../features/reports/reportModel";

const SUPPORT_CACHE_KEY = "@protegela:cache:support_locations";
const SSP_CACHE_KEY = "@protegela:cache:ssp_reports";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const CACHE_RADIUS_M = 500;

interface CachedEntry<T> {
  coords: Coordinates;
  timestamp: number;
  items: T[];
}

let memorySupportCache: CachedEntry<SupportLocation> | null = null;
let memorySspCache: CachedEntry<DangerReport> | null = null;

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinA =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sinA), Math.sqrt(1 - sinA));
}

function isCacheValid<T>(entry: CachedEntry<T> | null, coords: Coordinates): boolean {
  if (!entry || !Array.isArray(entry.items) || entry.items.length === 0) return false;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return false;
  return distanceMeters(entry.coords, coords) < CACHE_RADIUS_M;
}

export async function getCachedSupportLocations(
  coords: Coordinates,
): Promise<{ items: SupportLocation[]; fresh: boolean } | null> {
  if (memorySupportCache) {
    return {
      items: memorySupportCache.items,
      fresh: isCacheValid(memorySupportCache, coords),
    };
  }
  try {
    const raw = await AsyncStorage.getItem(SUPPORT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<SupportLocation>;
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;
    memorySupportCache = parsed;
    return {
      items: parsed.items,
      fresh: isCacheValid(parsed, coords),
    };
  } catch {
    return null;
  }
}

export async function setCachedSupportLocations(
  coords: Coordinates,
  items: SupportLocation[],
): Promise<void> {
  if (!items.length) return;
  const entry: CachedEntry<SupportLocation> = {
    coords,
    timestamp: Date.now(),
    items,
  };
  memorySupportCache = entry;
  await AsyncStorage.setItem(SUPPORT_CACHE_KEY, JSON.stringify(entry)).catch(() => {});
}

export async function getCachedSspReports(
  coords: Coordinates,
): Promise<{ items: DangerReport[]; fresh: boolean } | null> {
  if (memorySspCache) {
    return {
      items: memorySspCache.items,
      fresh: isCacheValid(memorySspCache, coords),
    };
  }
  try {
    const raw = await AsyncStorage.getItem(SSP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<DangerReport>;
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;
    memorySspCache = parsed;
    return {
      items: parsed.items,
      fresh: isCacheValid(parsed, coords),
    };
  } catch {
    return null;
  }
}

export async function setCachedSspReports(
  coords: Coordinates,
  items: DangerReport[],
): Promise<void> {
  const entry: CachedEntry<DangerReport> = {
    coords,
    timestamp: Date.now(),
    items,
  };
  memorySspCache = entry;
  await AsyncStorage.setItem(SSP_CACHE_KEY, JSON.stringify(entry)).catch(() => {});
}
