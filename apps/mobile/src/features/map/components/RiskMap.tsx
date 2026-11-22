import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Platform, ActivityIndicator, Text } from "react-native";
import { Coordinates, SupportLocation, RiskZoneFeature } from "../types";
import { Report } from "../../../types/report";
import { colors } from "../../../theme/colors";
import { useAppTheme } from "../../../theme";

export type MapTileStyle = "clean" | "clean_dark" | "streets" | "satellite";

export interface MapRoutePolyline {
  id: string;
  coordinates: Coordinates[];
  color?: string;
  weight?: number;
  opacity?: number;
  isSelected?: boolean;
}

export interface RiskMapProps {
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
  reports?: Report[];
  onSelectReport?: (report: Report) => void;
  onSelectSupportLocation?: (location: SupportLocation) => void;
  onMapClick?: (coords: Coordinates) => void;
  interactive?: boolean;
}

const TILE_PROVIDERS: Record<MapTileStyle, { url: string; attribution: string }> = {
  // 1. Clean Claro Minimalista Elegante (Stadia Alidade Smooth)
  // 100% minimalista, sem poluição de cores saturadas
  clean: {
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    attribution: "",
  },
  // 2. Clean Escuro Noturno (Stadia Alidade Smooth Dark)
  clean_dark: {
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    attribution: "",
  },
  // 3. Ruas e Estabelecimentos (OSM Oficial)
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "",
  },
  // 4. Imagem real de Satélite / Aérea (Esri World Imagery)
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "",
  },
};

/**
 * Componente unificado de Mapa interativo para Web e Mobile.
 * Na Web, utiliza Leaflet.js injetado via container DOM dinâmico com suporte
 * a polígonos, círculos de calor vetoriais e marcadores estilizados.
 */
export const RiskMap: React.FC<RiskMapProps> = ({
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
  onMapClick,
}) => {
  const { isDark } = useAppTheme();
  const mapContainerRef = useRef<any>(null);
  const leafletMapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const zonesLayerRef = useRef<any>(null);
  const routesLayerRef = useRef<any>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    // Carregar CSS do Leaflet se ainda não existir
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Carregar Script do Leaflet se ainda não existir
    const loadLeafletScript = () => {
      return new Promise<void>((resolve) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve();
        document.body.appendChild(script);
      });
    };

    let isMounted = true;

    loadLeafletScript().then(() => {
      if (!isMounted || !mapContainerRef.current) return;
      const L = (window as any).L;

      const provider = TILE_PROVIDERS[mapStyle] || TILE_PROVIDERS.clean;

      // Se o mapa ainda não foi inicializado
      if (!leafletMapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [center.latitude, center.longitude],
          zoom,
          zoomControl: false, // Desativa os botões nativos +/- de zoom
          attributionControl: false, // Remove a barra de créditos inferior
        });

        // Adiciona camada de tiles conforme o estilo escolhido
        const tileLayer = L.tileLayer(provider.url, {
          attribution: "",
          maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        const zonesLayer = L.layerGroup().addTo(map);
        const routesLayer = L.layerGroup().addTo(map);

        map.on("click", (e: any) => {
          if (onMapClickRef.current && e?.latlng) {
            onMapClickRef.current({
              latitude: Number(e.latlng.lat),
              longitude: Number(e.latlng.lng),
            });
          }
        });

        leafletMapInstanceRef.current = map;
        tileLayerRef.current = tileLayer;
        markersLayerRef.current = markersLayer;
        zonesLayerRef.current = zonesLayer;
        routesLayerRef.current = routesLayer;
      } else {
        // Atualiza a posição da visualização com animação suave
        leafletMapInstanceRef.current.flyTo([center.latitude, center.longitude], zoom, {
          duration: 1.2,
        });

        // Atualizar camada de tiles se o estilo mudar
        if (tileLayerRef.current && tileLayerRef.current._url !== provider.url) {
          tileLayerRef.current.setUrl(provider.url);
        }
      }

      const L_instance = (window as any).L;
      if (!L_instance) return;

      const markersLayer = markersLayerRef.current;
      const zonesLayer = zonesLayerRef.current;
      let routesLayer = routesLayerRef.current;

      if (!routesLayer && leafletMapInstanceRef.current) {
        routesLayer = L_instance.layerGroup().addTo(leafletMapInstanceRef.current);
        routesLayerRef.current = routesLayer;
      }

      if (!markersLayer || !zonesLayer) return;

      markersLayer.clearLayers();
      zonesLayer.clearLayers();
      if (routesLayer) {
        routesLayer.clearLayers();
      }

      // Marcador da Usuária (Ponto roxo/azul pulsante de alta visibilidade)
      if (userLocation) {
        const userIcon = L_instance.divIcon({
          className: "user-loc-icon",
          html: `<div style="
            position: relative;
            width: 24px; 
            height: 24px; 
            background: #7C3AED; 
            border: 3px solid #ffffff; 
            border-radius: 50%; 
            box-shadow: 0 0 12px rgba(124, 58, 237, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 8px;
              height: 8px;
              background: #ffffff;
              border-radius: 50%;
            "></div>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L_instance.marker([userLocation.latitude, userLocation.longitude], {
          icon: userIcon,
          zIndexOffset: 1000,
        })
          .bindPopup("<b style='font-family: sans-serif; color: #7C3AED;'>Você está aqui</b>")
          .addTo(markersLayer);
      }

      // Marcador de Ponto Selecionado / Endereço Pesquisado
      if (selectedLocation) {
        const selIcon = L_instance.divIcon({
          className: "selected-pin-icon",
          html: `<div style="
            position: relative;
            width: 32px;
            height: 38px;
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
          ">
            <div style="
              width: 30px;
              height: 30px;
              background: #9333EA;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid #FFFFFF;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(147, 51, 234, 0.45);
            ">
              <span style="
                transform: rotate(45deg);
                font-size: 15px;
                display: block;
              ">📍</span>
            </div>
          </div>`,
          iconSize: [32, 38],
          iconAnchor: [16, 36],
        });

        L_instance.marker([selectedLocation.latitude, selectedLocation.longitude], {
          icon: selIcon,
          zIndexOffset: 900,
        })
          .bindPopup("<b style='font-family: sans-serif; color: #9333EA;'>Local Selecionado</b>")
          .addTo(markersLayer);
      }

      // Marcador de Destino no Modo Rota (Estilo Imagem 2 - pino roxo com centro branco)
      if (destinationLocation) {
        const destIcon = L_instance.divIcon({
          className: "destination-pin-icon",
          html: `<div style="
            position: relative;
            width: 34px;
            height: 42px;
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              width: 32px;
              height: 32px;
              background: #8055B5;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 3px solid #FFFFFF;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 14px rgba(128, 85, 181, 0.55);
            ">
              <div style="
                width: 10px;
                height: 10px;
                background: #FFFFFF;
                border-radius: 50%;
              "></div>
            </div>
          </div>`,
          iconSize: [34, 42],
          iconAnchor: [17, 40],
        });

        L_instance.marker([destinationLocation.latitude, destinationLocation.longitude], {
          icon: destIcon,
          zIndexOffset: 950,
        })
          .bindPopup("<b style='font-family: sans-serif; color: #8055B5;'>Destino da Rota</b>")
          .addTo(markersLayer);
      }

      // Renderizar Trajetos de Rotas no Mapa (Polylines em Roxo Conforme o Tema)
      if (routes && routes.length > 0 && routesLayer) {
        let activePolylineToFit: any = null;

        // Renderiza primeiro as rotas alternativas não selecionadas (em segundo plano, lavanda suave)
        routes
          .filter((r) => r.id !== selectedRouteId && !r.isSelected)
          .forEach((route) => {
            const latLngs = route.coordinates.map((c) => [c.latitude, c.longitude]);
            if (latLngs.length >= 2) {
              L_instance.polyline(latLngs, {
                color: isDark ? "#6D28D9" : "#C4B5FD",
                weight: route.weight || 4,
                opacity: 0.7,
                lineCap: "round",
                lineJoin: "round",
              }).addTo(routesLayer);
            }
          });

        // Renderiza a rota ativa selecionada com destaque máximo:
        // No tema claro: roxo escuro (#5B21B6)
        // No tema escuro: roxo vibrante (#C4A5F3)
        const activeRoute =
          routes.find((r) => r.id === selectedRouteId) ||
          routes.find((r) => r.isSelected) ||
          routes[0];

        if (activeRoute) {
          const latLngs = activeRoute.coordinates.map((c) => [c.latitude, c.longitude]);
          if (latLngs.length >= 2) {
            const coreColor = isDark ? "#C4A5F3" : "#5B21B6";
            const casingColor = isDark ? "#1E1630" : "#2E1065";

            // Casing externo escuro para contraste perfeito contra as ruas
            L_instance.polyline(latLngs, {
              color: casingColor,
              weight: 8,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(routesLayer);

            // Traçado principal roxo
            activePolylineToFit = L_instance.polyline(latLngs, {
              color: coreColor,
              weight: 5,
              opacity: 1.0,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(routesLayer);
          }
        }

        // Traz as rotas para a frente
        if (typeof (routesLayer as any).bringToFront === "function") {
          (routesLayer as any).bringToFront();
        }

        // Enquadra a visão do mapa para mostrar a rota completa suavemente, respeitando a barra superior e o bottom sheet inferior
        if (activePolylineToFit && leafletMapInstanceRef.current) {
          try {
            leafletMapInstanceRef.current.fitBounds(activePolylineToFit.getBounds(), {
              paddingTopLeft: [70, 40],
              paddingBottomRight: [40, 260],
              maxZoom: 16,
            });
          } catch {
            // Ignora falha de bounds se o mapa estiver redimensionando
          }
        }
      }

      // Renderizar Zonas de Risco (Círculos e Polígonos Vetoriais)
      riskZones.forEach((zone) => {
        const color =
          zone.risk_level === "high"
            ? "#DC2626"
            : zone.risk_level === "medium"
            ? "#EA580C"
            : "#CA8A04";

        if (zone.polygon_coordinates && zone.polygon_coordinates.length > 0) {
          const latLngs = zone.polygon_coordinates.map((c) => [c.latitude, c.longitude]);
          L_instance.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 2,
          })
            .bindPopup(`<b>${zone.name}</b><br/>Área de Atenção (${zone.risk_level})`)
            .addTo(zonesLayer);
        } else if (zone.center) {
          L_instance.circle([zone.center.latitude, zone.center.longitude], {
            radius: zone.radius_meters || 250,
            color,
            fillColor: color,
            fillOpacity: 0.22,
            weight: 1.5,
          })
            .bindPopup(`<b>${zone.name}</b><br/>Nível de Risco: ${zone.risk_level}`)
            .addTo(zonesLayer);
        }
      });

      // Renderizar Relatos de Perigo
      reports.forEach((rep) => {
        const repIcon = L_instance.divIcon({
          className: "report-icon",
          html: `<div style="
            width: 28px;
            height: 28px;
            background: #DC2626;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">⚠️</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const m = L_instance.marker([rep.location.latitude, rep.location.longitude], {
          icon: repIcon,
        }).addTo(markersLayer);

        m.bindPopup(`
          <div style="font-family: sans-serif; min-width: 140px;">
            <strong style="color: #991B1B;">${rep.category}</strong>
            <p style="margin: 4px 0; font-size: 12px; color: #374151;">${rep.description || "Sem descrição adicional."}</p>
            <span style="font-size: 10px; color: #6B7280;">Confirmações: ${rep.confirmations_count}</span>
          </div>
        `);

        if (onSelectReport) {
          m.on("click", () => onSelectReport(rep));
        }
      });

      // Renderizar Locais de Apoio / Delegacias com Pin Moderno Estilizado
      supportLocations.forEach((loc) => {
        const supIcon = L_instance.divIcon({
          className: "support-pin",
          html: `<div style="
            position: relative;
            width: 32px;
            height: 38px;
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
          ">
            <div style="
              width: 32px;
              height: 32px;
              background: #6D4DA8;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid #FFFFFF;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(109, 77, 168, 0.4);
            ">
              <span style="
                transform: rotate(45deg);
                font-size: 14px;
                color: #FFFFFF;
                display: block;
              ">🏛️</span>
            </div>
          </div>`,
          iconSize: [32, 38],
          iconAnchor: [16, 36],
        });

        const m = L_instance.marker([loc.latitude, loc.longitude], {
          icon: supIcon,
          zIndexOffset: 500,
        }).addTo(markersLayer);

        const distanceText = loc.distance_meters
          ? `<div style="margin-top: 6px; font-size: 11px; font-weight: 600; color: #059669; background: #ECFDF5; padding: 2px 6px; border-radius: 4px; display: inline-block;">Aprox. ${(loc.distance_meters / 1000).toFixed(1)} km</div>`
          : "";

        m.bindPopup(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 170px; padding: 4px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 16px;">🛡️</span>
              <strong style="color: #5B21B6; font-size: 13px;">${loc.name}</strong>
            </div>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #4B5563;">Ponto de Apoio Oficial (Polícia / Delegacia)</p>
            ${distanceText}
          </div>
        `);

        if (onSelectSupportLocation) {
          m.on("click", () => onSelectSupportLocation(loc));
        }
      });
    });

    return () => {
      isMounted = false;
    };
  }, [
    center,
    zoom,
    userLocation,
    selectedLocation,
    destinationLocation,
    routes,
    selectedRouteId,
    mapStyle,
    supportLocations,
    riskZones,
    reports,
  ]);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.nativeFallbackContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.fallbackText}>
          Carregando visualização do mapa...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
  },
  nativeFallbackContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  fallbackText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
});

