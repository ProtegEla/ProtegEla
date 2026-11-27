import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { Coordinates, RiskZoneFeature } from "../../features/map/types";
import type { DangerReport } from "../../features/reports/reportModel";

interface BackendPointGeometry {
  type: "Point";
  coordinates: [number, number];
}

interface BackendPolygonGeometry {
  type: "Polygon";
  coordinates: [number, number][][];
}

interface BackendMultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
}

interface BackendZoneFeature {
  id: string;
  geometry:
    | BackendPointGeometry
    | BackendPolygonGeometry
    | BackendMultiPolygonGeometry;
  properties: {
    marker_location: BackendPointGeometry;
    categories: string[];
    sources: ("app" | "ssp")[];
    incidents_count: number;
  };
}

interface BackendZoneResponse {
  data: {
    type: "FeatureCollection";
    features: BackendZoneFeature[];
  };
  meta: {
    total_records: number;
  };
}

function classifyRiskLevel(
  categories: string[],
  incidentsCount: number
): "low" | "medium" | "high" {
  if (incidentsCount >= 5 || categories.includes("Violência")) {
    return "high";
  }
  if (incidentsCount >= 2 || categories.includes("Roubo")) {
    return "medium";
  }
  return "low";
}

function extractPolygonCoordinates(
  geometry: BackendZoneFeature["geometry"]
): Coordinates[] | undefined {
  if (geometry.type === "Polygon" && geometry.coordinates[0]?.length) {
    return geometry.coordinates[0].map(([lon, lat]) => ({
      latitude: lat,
      longitude: lon,
    }));
  }
  if (
    geometry.type === "MultiPolygon" &&
    geometry.coordinates[0]?.[0]?.length
  ) {
    return geometry.coordinates[0][0].map(([lon, lat]) => ({
      latitude: lat,
      longitude: lon,
    }));
  }
  return undefined;
}

export interface SspZoneItem extends RiskZoneFeature {
  primaryCategory: string;
}

export const riskZonesService = {
  /**
   * Consulta zonas de risco dentro de uma caixa geográfica (bbox) ao redor da coordenada.
   */
  async getNearby(
    center: Coordinates,
    deltaDeg = 0.009
  ): Promise<SspZoneItem[]> {
    const minLon = (center.longitude - deltaDeg).toFixed(6);
    const minLat = (center.latitude - deltaDeg).toFixed(6);
    const maxLon = (center.longitude + deltaDeg).toFixed(6);
    const maxLat = (center.latitude + deltaDeg).toFixed(6);

    const response = await apiClient.get<BackendZoneResponse>(
      ENDPOINTS.RISK_ZONES.BASE,
      {
        params: { bbox: `${minLon},${minLat},${maxLon},${maxLat}` },
      }
    );

    const features = response.data?.data?.features ?? [];
    return features.map((feature) => {
      const { marker_location, categories, incidents_count } =
        feature.properties;
      const centerCoords: Coordinates = {
        latitude: marker_location.coordinates[1],
        longitude: marker_location.coordinates[0],
      };

      const labelCount =
        incidents_count === 1 ? "1 ocorrência" : `${incidents_count} ocorrências`;

      return {
        id: feature.id,
        primaryCategory: categories[0] || "Furto",
        name: `${categories.join(", ")} (${labelCount})`,
        risk_level: classifyRiskLevel(categories, incidents_count),
        center: centerCoords,
        radius_meters: 25,
        polygon_coordinates: extractPolygonCoordinates(feature.geometry),
        reports_count: incidents_count,
      };
    });
  },

  /**
   * Converte ocorrências/zonas oficiais SSP em marcadores clicáveis para o mapa e modal de detalhes.
   */
  toDangerReports(zones: SspZoneItem[]): DangerReport[] {
    return zones.map((zone) => ({
      id: `ssp-${zone.id}`,
      category: zone.primaryCategory,
      description: `Dado oficial registrado pela Secretaria de Segurança Pública (SSP-SP): ${zone.name}.`,
      location: zone.center,
      address: "Ocorrência oficial · SSP-SP",
      addressDetail: "",
      period: "Noturno",
      isAnonymous: false,
      author: "SSP-SP (Oficial)",
      createdAt: new Date().toISOString(),
      confirmations_count: zone.reports_count ?? 1,
      confirmedByMe: false,
      comments: [],
    }));
  },
};
