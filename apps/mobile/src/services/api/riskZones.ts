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
  sources: ("app" | "ssp")[];
}

interface BackendIncidentItem {
  id: string;
  source: "app" | "ssp";
  category: string;
  description: string | null;
  incident_date: string;
}

interface BackendIncidentPage {
  data: BackendIncidentItem[];
  meta: {
    total_records: number;
  };
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
      const { marker_location, categories, sources, incidents_count } =
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
        sources: Array.isArray(sources) && sources.length ? sources : ["ssp"],
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
   * Busca zonas de risco ao longo de toda a trajetória de uma ou mais rotas,
   * amostrando pontos a cada ~1.5 km e deduplicando por id.
   */
  async getAlongRoute(
    routeCoordinates: Coordinates[],
    stepMeters = 1500
  ): Promise<SspZoneItem[]> {
    if (routeCoordinates.length === 0) return [];

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const distM = (a: Coordinates, b: Coordinates) => {
      const R = 6_371_000;
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
          Math.cos(toRad(b.latitude)) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    const samples: Coordinates[] = [routeCoordinates[0]];
    let lastSample = routeCoordinates[0];
    for (let i = 1; i < routeCoordinates.length - 1; i += 1) {
      if (distM(lastSample, routeCoordinates[i]) >= stepMeters) {
        samples.push(routeCoordinates[i]);
        lastSample = routeCoordinates[i];
      }
    }
    const last = routeCoordinates[routeCoordinates.length - 1];
    if (distM(lastSample, last) > 200) {
      samples.push(last);
    }

    const cappedSamples = samples.slice(0, 15);
    const batches = await Promise.all(
      cappedSamples.map((pt) => this.getNearby(pt).catch(() => [] as SspZoneItem[]))
    );

    const seen = new Map<string, SspZoneItem>();
    for (const batch of batches) {
      for (const zone of batch) {
        if (!seen.has(zone.id)) {
          seen.set(zone.id, zone);
        }
      }
    }
    return Array.from(seen.values());
  },

  /**
   * Busca as datas e categorias reais das ocorrências de uma zona SSP no Supabase.
   */
  async getZoneIncidents(
    zoneId: string,
    center?: Coordinates
  ): Promise<BackendIncidentItem[]> {
    const cleanId = zoneId.replace(/^ssp-/, "");
    const response = await apiClient.get<BackendIncidentPage>(
      ENDPOINTS.RISK_ZONES.INCIDENTS(cleanId),
      {
        params: {
          page: 1,
          page_size: 20,
          ...(center ? { lat: center.latitude, lon: center.longitude } : {}),
        },
      }
    );
    return response.data?.data ?? [];
  },

  /**
   * Converte ocorrências/zonas oficiais SSP e relatos da comunidade em marcadores clicáveis.
   */
  toDangerReports(zones: SspZoneItem[]): DangerReport[] {
    return zones.map((zone) => {
      const hasApp = zone.sources.includes("app");
      if (hasApp) {
        return {
          id: `appzone-${zone.id}`,
          source: "app",
          category: zone.primaryCategory,
          description: `Relato da comunidade (${zone.name}).`,
          location: zone.center,
          address: "Relato da comunidade",
          addressDetail: "",
          period: "",
          incidentsCount: zone.reports_count ?? 1,
          isAnonymous: false,
          author: "Comunidade",
          createdAt: "",
          confirmations_count: zone.reports_count ?? 1,
          confirmedByMe: false,
          comments: [],
        };
      }
      return {
        id: `ssp-${zone.id}`,
        source: "ssp",
        category: zone.primaryCategory,
        description: `Dado oficial registrado pela Secretaria de Segurança Pública (SSP-SP): ${zone.name}.`,
        location: zone.center,
        address: "Ocorrência oficial · SSP-SP",
        addressDetail: "",
        period: "",
        incidentsCount: zone.reports_count ?? 1,
        isAnonymous: false,
        author: "SSP-SP (Oficial)",
        createdAt: "",
        confirmations_count: zone.reports_count ?? 1,
        confirmedByMe: false,
        comments: [],
      };
    });
  },
};
