import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { Coordinates } from "../types";

// Centro padrão: Praça da Sé / Marco Zero de São Paulo
export const DEFAULT_SP_COORDINATES: Coordinates = {
  latitude: -23.55052,
  longitude: -46.633308,
};

export interface UseCurrentLocationResult {
  location: Coordinates | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
  refreshLocation: () => Promise<Coordinates | null>;
}

/**
 * Hook para obter a localização atual do usuário de forma compatível
 * com Web (Navegador) e Mobile (Android/iOS) usando expo-location.
 */
export function useCurrentLocation(): UseCurrentLocationResult {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const requestAndFetchLocation = useCallback(async (): Promise<Coordinates | null> => {
    setLoading(true);
    setError(null);

    // 1. PRIORIDADE WEB (Navegador Desktop / Chrome / Edge / Firefox)
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && "geolocation" in navigator) {
      try {
        const browserCoords = await new Promise<Coordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
            },
            (err) => reject(err),
            // Tenta alta precisão primeiro (8s timeout)
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        });

        setPermissionGranted(true);
        setLocation(browserCoords);
        setLoading(false);
        return browserCoords;
      } catch (firstErr) {
        // Fallback no navegador: muitos desktops não têm GPS físico e falham com highAccuracy.
        // Tentamos com enableHighAccuracy: false (obtém por IP/Wi-Fi da operadora).
        try {
          const fallbackCoords = await new Promise<Coordinates>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              (err) => reject(err),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
          });

          setPermissionGranted(true);
          setLocation(fallbackCoords);
          setLoading(false);
          return fallbackCoords;
        } catch (secondErr) {
          console.warn("Geolocalização rejeitada ou indisponível no navegador:", secondErr);
          setError("Não foi possível obter a localização do navegador.");
        }
      }
    }

    // 2. MOBILE (Android / iOS via Expo Location)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionGranted(false);
        setError("Permissão de localização não concedida.");
        setLocation(DEFAULT_SP_COORDINATES);
        setLoading(false);
        return DEFAULT_SP_COORDINATES;
      }

      setPermissionGranted(true);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(coords);
      return coords;
    } catch (err: any) {
      console.warn("Erro ao obter localização mobile:", err);
      setError("Não foi possível obter sua localização exata.");
      setLocation(DEFAULT_SP_COORDINATES);
      return DEFAULT_SP_COORDINATES;
    } finally {
      setLoading(false);
    }
  }, []);

  // Monitoramento contínuo / watchPosition em tempo real
  useEffect(() => {
    requestAndFetchLocation();

    // watchPosition com threshold de 10m — evita re-renders por oscilações de GPS de desktop
    let watchId: number | null = null;
    let lastWatchLat: number | null = null;
    let lastWatchLon: number | null = null;

    const THRESHOLD_M = 10; // só atualiza se mover mais de 10m
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6_371_000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    if (typeof window !== "undefined" && typeof navigator !== "undefined" && "geolocation" in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            if (
              lastWatchLat !== null &&
              lastWatchLon !== null &&
              haversine(lastWatchLat, lastWatchLon, latitude, longitude) < THRESHOLD_M
            ) {
              return; // Oscilação insignificante — ignora
            }
            lastWatchLat = latitude;
            lastWatchLon = longitude;
            setLocation({ latitude, longitude });
            setPermissionGranted(true);
          },
          () => {},
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
        );
      } catch {
        // Ignora caso não suporte watch
      }
    }

    return () => {
      if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [requestAndFetchLocation]);

  return {
    location,
    loading,
    error,
    permissionGranted,
    refreshLocation: requestAndFetchLocation,
  };
}

