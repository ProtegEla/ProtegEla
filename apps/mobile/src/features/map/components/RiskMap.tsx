import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type {
  Coordinates,
  SupportLocation,
  RiskZoneFeature,
} from "../types";

import {
  isValidCoordinates,
  type RiskMapReport,
} from "../../reports/reportModel";

import { useAppTheme } from "../../../theme";

import {
  createReportMarkerIcon,
  createSelectedLocationIcon,
} from "../../reports/mapMarkerIcons";

export type MapTileStyle =
  | "clean"
  | "clean_dark"
  | "streets"
  | "satellite";

export interface MapRoutePolyline {
  id: string;
  coordinates: Coordinates[];
  color?: string;
  weight?: number;
  opacity?: number;
  isSelected?: boolean;
}

export interface RiskMapProps<
  TReport extends RiskMapReport = RiskMapReport,
> {
  center: Coordinates;
  zoom?: number;
  userLocation?: Coordinates | null;
  selectedLocation?: Coordinates | null;
  destinationLocation?: Coordinates | null;

  routes?: MapRoutePolyline[];
  selectedRouteId?: string | null;

  mapStyle?: MapTileStyle;
  supportLocations?: SupportLocation[];
  riskZones?: RiskZoneFeature[];
  reports?: TReport[];

  onSelectReport?: (report: TReport) => void;
  onSelectSupportLocation?: (location: SupportLocation) => void;

  // Compatibilidade com as duas branches.
  onMapPress?: (coordinates: Coordinates) => void;
  onMapClick?: (coordinates: Coordinates) => void;

  interactive?: boolean;
  cameraRevision?: number;
}

const TILE_PROVIDERS: Record<
  MapTileStyle,
  { url: string; attribution: string }
> = {
  clean: {
    url:
      "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' +
      '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ' +
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  clean_dark: {
    url:
      "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' +
      '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ' +
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
};

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href =
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

    document.head.appendChild(link);
  }

  if ((window as any).L) {
    return Promise.resolve((window as any).L);
  }

  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(
      "leaflet-js",
    ) as HTMLScriptElement | null;

    const script =
      existing ?? document.createElement("script");

    script.addEventListener(
      "load",
      () => {
        const L = (window as any).L;

        if (L) {
          resolve(L);
        } else {
          leafletPromise = null;
          script.remove();
          reject(new Error("Leaflet indisponível."));
        }
      },
      { once: true },
    );

    script.addEventListener(
      "error",
      () => {
        leafletPromise = null;
        script.remove();
        reject(new Error("Falha ao carregar o mapa."));
      },
      { once: true },
    );

    if (!existing) {
      script.id = "leaflet-js";
      script.src =
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

      document.head.appendChild(script);
    }
  });

  return leafletPromise;
}

function createPopup(title: string, description?: string) {
  const container = document.createElement("div");

  container.style.cssText =
    "font-family:system-ui,sans-serif;min-width:160px;padding:4px;";

  const heading = document.createElement("strong");
  heading.style.color = "#593582";
  heading.textContent = title;

  container.appendChild(heading);

  if (description) {
    const paragraph = document.createElement("p");

    paragraph.style.cssText =
      "font-size:12px;line-height:18px;margin:6px 0 0;color:#475569;";

    paragraph.textContent = description;
    container.appendChild(paragraph);
  }

  return container;
}

function createMarkerIcon(
  L: any,
  color: string,
  symbol: string,
) {
  const element = document.createElement("div");

  element.style.cssText = `
    width: 32px;
    height: 32px;
    box-sizing: border-box;
    border: 3px solid white;
    border-radius: 50%;
    background: ${color};
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 800 16px system-ui, sans-serif;
    box-shadow: 0 3px 10px rgba(30,20,45,0.25);
  `;

  element.textContent = symbol;

  return L.divIcon({
    className: "",
    html: element,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function RiskMap<
  TReport extends RiskMapReport = RiskMapReport,
>({
  center,
  zoom = 15,
  userLocation,
  selectedLocation,
  destinationLocation,
  routes = [],
  selectedRouteId,
  mapStyle = "clean",
  supportLocations = [],
  riskZones = [],
  reports = [],
  onSelectReport,
  onSelectSupportLocation,
  onMapPress,
  onMapClick,
  interactive = true,
  cameraRevision = 0,
}: RiskMapProps<TReport>) {
  const { colors, isDark } = useAppTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const zonesRef = useRef<any>(null);
  const routesRef = useRef<any>(null);

  const fittedRouteRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const callbacksRef = useRef({
    onSelectReport,
    onSelectSupportLocation,
    onMapPress,
    onMapClick,
    interactive,
  });

  const initialViewRef = useRef({ center, zoom });

  useEffect(() => {
    callbacksRef.current = {
      onSelectReport,
      onSelectSupportLocation,
      onMapPress,
      onMapClick,
      interactive,
    };
  }, [
    onSelectReport,
    onSelectSupportLocation,
    onMapPress,
    onMapClick,
    interactive,
  ]);

  useEffect(() => {
    initialViewRef.current = { center, zoom };
  }, [center, zoom]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    let active = true;
    let ownedMap: any;
    let observer: ResizeObserver | undefined;

    setReady(false);
    setError("");

    loadLeaflet()
      .then((L) => {
        if (!active || !containerRef.current) return;

        const initial = initialViewRef.current;

        ownedMap = L.map(containerRef.current, {
          center: [
            initial.center.latitude,
            initial.center.longitude,
          ],
          zoom: initial.zoom,
          zoomControl: false,
          attributionControl: true,
        });

        leafletRef.current = L;
        mapRef.current = ownedMap;

        markersRef.current = L.layerGroup().addTo(ownedMap);
        zonesRef.current = L.layerGroup().addTo(ownedMap);
        routesRef.current = L.layerGroup().addTo(ownedMap);

        const routePane =
          ownedMap.createPane("report-routes");

        routePane.style.zIndex = "450";

        ownedMap.on("click", (event: any) => {
          const callbacks = callbacksRef.current;

          if (!callbacks.interactive) return;

          const position = event.latlng.wrap();

          const coordinates: Coordinates = {
            latitude: position.lat,
            longitude: position.lng,
          };

          if (isValidCoordinates(coordinates)) {
            // Executa somente um callback.
            (callbacks.onMapPress ??
              callbacks.onMapClick)?.(coordinates);
          }
        });

        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            if (active) ownedMap.invalidateSize({ pan: false });
          });

          observer.observe(containerRef.current);
        }

        requestAnimationFrame(() => {
          if (active) ownedMap.invalidateSize({ pan: false });
        });

        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(
            "Não foi possível carregar o mapa. Verifique sua conexão.",
          );
        }
      });

    return () => {
      active = false;
      observer?.disconnect();

      if (ownedMap) {
        ownedMap.remove();

        if (mapRef.current === ownedMap) {
          mapRef.current = null;
          markersRef.current = null;
          zonesRef.current = null;
          routesRef.current = null;
          fittedRouteRef.current = null;
          tileRef.current = null;
          leafletRef.current = null;
        }
      }
    };
  }, [attempt]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!isValidCoordinates(center)) return;

    mapRef.current.flyTo(
      [center.latitude, center.longitude],
      zoom,
      { duration: 0.8 },
    );
  }, [
    ready,
    center.latitude,
    center.longitude,
    zoom,
    cameraRevision,
  ]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const L = leafletRef.current;
    const provider = TILE_PROVIDERS[mapStyle];

    tileRef.current?.remove();

    tileRef.current = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, [ready, mapStyle]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const map = mapRef.current;

    [
      "dragging",
      "touchZoom",
      "doubleClickZoom",
      "scrollWheelZoom",
      "boxZoom",
      "keyboard",
    ].forEach((name) => {
      const handler = map[name];

      if (!handler) return;

      if (interactive) handler.enable();
      else handler.disable();
    });
  }, [ready, interactive]);

  useEffect(() => {
    if (!ready || !markersRef.current) return;

    const L = leafletRef.current;
    const layer = markersRef.current;

    layer.clearLayers();

    if (
      userLocation &&
      isValidCoordinates(userLocation)
    ) {
      L.circleMarker(
        [userLocation.latitude, userLocation.longitude],
        {
          radius: 8,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#7C3AED",
          fillOpacity: 1,
        },
      )
        .bindPopup(createPopup("Você está aqui"))
        .addTo(layer);
    }

    if (
      selectedLocation &&
      isValidCoordinates(selectedLocation)
    ) {
      L.marker(
        [
          selectedLocation.latitude,
          selectedLocation.longitude,
        ],
        {
          icon: createSelectedLocationIcon(L),
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        },
      ).addTo(layer);
    }

    if (
      destinationLocation &&
      isValidCoordinates(destinationLocation)
    ) {
      const destination = document.createElement("div");

      destination.style.cssText =
        "width:32px;height:32px;box-sizing:border-box;" +
        "background:#8055B5;border:3px solid white;" +
        "border-radius:50% 50% 50% 0;transform:rotate(-45deg);" +
        "display:flex;align-items:center;justify-content:center;" +
        "box-shadow:0 4px 14px rgba(128,85,181,.55)";

      const dot = document.createElement("div");
      dot.style.cssText =
        "width:10px;height:10px;background:white;border-radius:50%";

      destination.appendChild(dot);

      L.marker(
        [
          destinationLocation.latitude,
          destinationLocation.longitude,
        ],
        {
          icon: L.divIcon({
            className: "",
            html: destination,
            iconSize: [34, 42],
            iconAnchor: [17, 36],
          }),
          zIndexOffset: 1100,
          keyboard: interactive,
          interactive,
          bubblingMouseEvents: false,
        },
      )
        .bindPopup(createPopup("Destino da rota"))
        .addTo(layer);
    }

    reports.forEach((report) => {
      if (!isValidCoordinates(report.location)) return;

      const marker = L.marker(
        [
          report.location.latitude,
          report.location.longitude,
        ],
        {
          icon: createReportMarkerIcon(L, report.category),
          title: report.category,
          keyboard: interactive,
          interactive,
          bubblingMouseEvents: false,
          riseOnHover: true,
        },
      ).addTo(layer);

      marker.on("click", () => {
        const callback =
          callbacksRef.current.onSelectReport;

        if (callback) {
          callback(report);
        } else {
          marker
            .bindPopup(
              createPopup(
                report.category,
                report.description ||
                  "Sem descrição adicional.",
              ),
            )
            .openPopup();
        }
      });
    });

    supportLocations.forEach((location) => {
      const coordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
      };

      if (!isValidCoordinates(coordinates)) return;

      const marker = L.marker(
        [location.latitude, location.longitude],
        {
          icon: createMarkerIcon(L, "#6D4DA8", "◆"),
          title: location.name,
          zIndexOffset: 500,
          interactive,
          keyboard: interactive,
          bubblingMouseEvents: false,
        },
      ).addTo(layer);

      marker.on("click", () => {
        const callback =
          callbacksRef.current.onSelectSupportLocation;

        if (callback) {
          callback(location);
          return;
        }

        const distance =
          typeof location.distance_meters === "number"
            ? `Aproximadamente ${(
                location.distance_meters / 1000
              ).toFixed(1)} km`
            : "Ponto de apoio";

        marker
          .bindPopup(createPopup(location.name, distance))
          .openPopup();
      });
    });
  }, [
    ready,
    reports,
    userLocation,
    selectedLocation,
    destinationLocation,
    supportLocations,
    interactive,
  ]);

  useEffect(() => {
    if (!ready || !routesRef.current) return;

    const L = leafletRef.current;
    const layer = routesRef.current;

    layer.clearLayers();

    const validRoutes = routes.filter(
      (route) =>
        route.coordinates.length >= 2 &&
        route.coordinates.every(isValidCoordinates),
    );

    const active =
      validRoutes.find(
        (route) => route.id === selectedRouteId,
      ) ??
      validRoutes.find((route) => route.isSelected) ??
      validRoutes[0];

    if (!active) {
      fittedRouteRef.current = null;
      return;
    }

    const baseOptions = {
      pane: "report-routes",
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    };

    validRoutes
      .filter((route) => route.id !== active.id)
      .forEach((route) => {
        L.polyline(
          route.coordinates.map((point) => [
            point.latitude,
            point.longitude,
          ]),
          {
            ...baseOptions,
            color: isDark ? "#6D28D9" : "#C4B5FD",
            weight: route.weight ?? 4,
            opacity: route.opacity ?? 0.7,
          },
        ).addTo(layer);
      });

    const coordinates = active.coordinates.map(
      (point) => [point.latitude, point.longitude],
    );

    L.polyline(coordinates, {
      ...baseOptions,
      color: isDark ? "#1E1630" : "#2E1065",
      weight: (active.weight ?? 5) + 3,
      opacity: 0.9,
    }).addTo(layer);

    const mainLine = L.polyline(coordinates, {
      ...baseOptions,
      color: isDark ? "#C4A5F3" : "#5B21B6",
      weight: active.weight ?? 5,
      opacity: active.opacity ?? 1,
    }).addTo(layer);

    const viewportKey = JSON.stringify([
      active.id,
      coordinates,
    ]);

    if (fittedRouteRef.current !== viewportKey) {
      try {
        mapRef.current.fitBounds(
          mainLine.getBounds(),
          {
            paddingTopLeft: [70, 40],
            paddingBottomRight: [40, 260],
            maxZoom: 16,
          },
        );

        fittedRouteRef.current = viewportKey;
      } catch {
        // O container pode estar mudando de tamanho.
      }
    }
  }, [
    ready,
    routes,
    selectedRouteId,
    isDark,
  ]);

  useEffect(() => {
    if (!ready || !zonesRef.current) return;

    const L = leafletRef.current;
    const layer = zonesRef.current;

    layer.clearLayers();

    riskZones.forEach((zone) => {
      const color =
        zone.risk_level === "high"
          ? "#DC2626"
          : zone.risk_level === "medium"
            ? "#EA580C"
            : "#CA8A04";

      const options = {
        color,
        fillColor: color,
        fillOpacity: 0.22,
        weight: 2,
        interactive,
      };

      let shape: any;

      if (zone.polygon_coordinates?.length) {
        shape = L.polygon(
          zone.polygon_coordinates.map(
            (coordinate) => [
              coordinate.latitude,
              coordinate.longitude,
            ],
          ),
          options,
        );
      } else if (zone.center) {
        shape = L.circle(
          [
            zone.center.latitude,
            zone.center.longitude,
          ],
          {
            ...options,
            radius: zone.radius_meters || 250,
          },
        );
      }

      if (shape) {
        shape
          .bindPopup(
            createPopup(
              zone.name,
              `Área de atenção · ${zone.risk_level}`,
            ),
          )
          .addTo(layer);
      }
    });
  }, [ready, riskZones, interactive]);

  if (Platform.OS !== "web") {
    return (
      <View
        style={[
          s.fallback,
          { backgroundColor: colors.screenBackground },
        ]}
      >
        <Text
          style={[
            s.fallbackTitle,
            { color: colors.text },
          ]}
        >
          Mapa disponível na versão web
        </Text>

        <Text
          style={[
            s.fallbackText,
            { color: colors.textMuted },
          ]}
        >
          A implementação nativa do mapa pode ser conectada
          aos mesmos dados e callbacks.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      />

      {!ready && !error && (
        <View style={s.status}>
          <ActivityIndicator color="#8055B5" />
          <Text style={s.fallbackText}>
            Carregando mapa…
          </Text>
        </View>
      )}

      {!!error && (
        <View style={s.status}>
          <Text style={s.fallbackText}>{error}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setAttempt((value) => value + 1)
            }
            style={s.retry}
          >
            <Text style={s.retryText}>
              Tentar novamente
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
    zIndex: 0,
  },
  fallback: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9E4F2",
    gap: 10,
  },
  fallbackTitle: {
    color: "#4A3475",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  fallbackText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  status: {
    ...StyleSheet.absoluteFillObject,
    padding: 24,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#8055B5",
    borderRadius: 12,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});