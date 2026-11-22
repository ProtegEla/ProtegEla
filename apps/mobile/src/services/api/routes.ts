import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteCalculateParams {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  stops?: RouteCoordinate[];
}

export interface BackendGeometry {
  type: "LineString";
  coordinates: [number, number][]; // [longitude, latitude]
}

export interface BackendRouteRisk {
  status: "evaluated" | "no_mapped_data" | "unavailable";
  exposure_score: number | null;
}

export interface BackendWalkingRoute {
  id: string;
  geometry: BackendGeometry;
  distance_m: number;
  duration_s: number;
  legs: unknown[];
  risk: BackendRouteRisk;
}

export interface BackendRouteComparison {
  fastest_route_id: string;
  lower_risk_route_id: string | null;
  extra_duration_percent: number | null;
  exceeds_30_percent: boolean | null;
  status: "lower_risk_available" | "no_lower_risk_alternative" | "no_mapped_data" | "risk_unavailable";
}

export interface BackendRouteCalculateResponse {
  data: {
    routes: BackendWalkingRoute[];
    comparison: BackendRouteComparison;
    attribution: string;
  };
}

export type RouteTypeTag = "recommended" | "fastest" | "safest";

export interface RouteOption {
  id: string;
  typeTag: RouteTypeTag;
  label: "Recomendada" | "Mais rápida" | "Mais segura";
  tagBgColor: string;
  durationMinutes: number;
  durationLabel: string;
  distanceKm: number;
  distanceLabel: string;
  riskLevel: "baixo" | "médio" | "alto";
  riskBadgeLabel: string;
  riskBadgeColor: string;
  coordinates: RouteCoordinate[];
  exposureScore: number | null;
}

export interface RouteCalculationResult {
  routes: RouteOption[];
  comparison: BackendRouteComparison;
  attribution: string;
}

export const routesService = {
  /**
   * Calcula alternativas de rotas a pé com avaliação de risco (RF15).
   * Consulta o endpoint POST /api/v1/routes/calculate.
   */
  async calculateRoutes(params: RouteCalculateParams): Promise<RouteCalculationResult> {
    const payload = {
      origin: {
        latitude: params.origin.latitude,
        longitude: params.origin.longitude,
      },
      destination: {
        latitude: params.destination.latitude,
        longitude: params.destination.longitude,
      },
      stops: params.stops || [],
    };

    const response = await apiClient.post<BackendRouteCalculateResponse>(
      ENDPOINTS.ROUTES.CALCULATE,
      payload
    );

    const rawData = response.data.data;
    const rawRoutes = rawData.routes || [];
    const comparison = rawData.comparison;

    // Quando o OpenRouteService retorna apenas 1 caminho físico (sem alternativas viárias para o trecho),
    // exibimos APENAS 1 card honesto — não derivamos rotas falsas com mesma geometria.
    if (rawRoutes.length === 1) {
      const single = rawRoutes[0];
      const baseCoords: RouteCoordinate[] = single.geometry.coordinates.map(([lon, lat]) => ({
        latitude: lat,
        longitude: lon,
      }));
      const baseDurationMin = Math.max(1, Math.round(single.duration_s / 60));
      const baseDistKm = Number((single.distance_m / 1000).toFixed(1));

      const score = single.risk.exposure_score ?? 0;
      let riskLevel: "baixo" | "médio" | "alto" = "baixo";
      let riskBadgeLabel = "Risco baixo";
      let riskBadgeColor = "#00796B";
      if (score > 50) {
        riskLevel = "alto";
        riskBadgeLabel = "Risco alto";
        riskBadgeColor = "#D32F2F";
      } else if (score > 15) {
        riskLevel = "médio";
        riskBadgeLabel = "Risco médio";
        riskBadgeColor = "#E65100";
      }

      return {
        routes: [
          {
            id: single.id,
            typeTag: "recommended",
            label: "Recomendada",
            tagBgColor: "#00695C",
            durationMinutes: baseDurationMin,
            durationLabel: `${baseDurationMin} min`,
            distanceKm: baseDistKm,
            distanceLabel: `${baseDistKm.toFixed(1).replace(".", ",")} km`,
            riskLevel,
            riskBadgeLabel,
            riskBadgeColor,
            coordinates: baseCoords,
            exposureScore: single.risk.exposure_score,
          },
        ],
        comparison,
        attribution: rawData.attribution,
      };
    }

    // Converte e categoriza as rotas para a interface (Imagem 2)
    const options: RouteOption[] = rawRoutes.map((route, index) => {
      const isFastest = route.id === comparison.fastest_route_id;
      const isLowestRisk = route.id === comparison.lower_risk_route_id;

      let typeTag: RouteTypeTag = "recommended";
      let label: "Recomendada" | "Mais rápida" | "Mais segura" = "Recomendada";
      let tagBgColor = "#00695C"; // Verde escuro da imagem

      if (isFastest && !isLowestRisk) {
        typeTag = "fastest";
        label = "Mais rápida";
        tagBgColor = "#00838F"; // Azul da imagem
      } else if (isLowestRisk && !isFastest) {
        typeTag = "safest";
        label = "Mais segura";
        tagBgColor = "#6A1B9A"; // Roxo da imagem
      } else if (index === 0) {
        typeTag = "recommended";
        label = "Recomendada";
        tagBgColor = "#00695C";
      } else if (index === 1) {
        typeTag = "fastest";
        label = "Mais rápida";
        tagBgColor = "#00838F";
      } else {
        typeTag = "safest";
        label = "Mais segura";
        tagBgColor = "#6A1B9A";
      }

      // Avaliação do badge de risco
      const score = route.risk.exposure_score ?? 0;
      let riskLevel: "baixo" | "médio" | "alto" = "baixo";
      let riskBadgeLabel = "Risco baixo";
      let riskBadgeColor = "#00796B";

      if (score > 50) {
        riskLevel = "alto";
        riskBadgeLabel = "Risco alto";
        riskBadgeColor = "#D32F2F";
      } else if (score > 15 || (typeTag === "fastest" && rawRoutes.length > 1)) {
        riskLevel = "médio";
        riskBadgeLabel = "Risco médio";
        riskBadgeColor = "#E65100";
      }

      // Converte GeoJSON [lon, lat] para { latitude, longitude } do mapa
      const coordinates: RouteCoordinate[] = route.geometry.coordinates.map(([lon, lat]) => ({
        latitude: lat,
        longitude: lon,
      }));

      const durationMinutes = Math.max(1, Math.round(route.duration_s / 60));
      const distanceKm = Number((route.distance_m / 1000).toFixed(1));

      return {
        id: route.id,
        typeTag,
        label,
        tagBgColor,
        durationMinutes,
        durationLabel: `${durationMinutes} min`,
        distanceKm,
        distanceLabel: `${distanceKm.toFixed(1).replace(".", ",")} km`,
        riskLevel,
        riskBadgeLabel,
        riskBadgeColor,
        coordinates,
        exposureScore: route.risk.exposure_score,
      };
    });

    // Ordena para que a "Recomendada" venha primeiro, depois "Mais rápida" e "Mais segura"
    const orderPriority: Record<RouteTypeTag, number> = {
      recommended: 0,
      fastest: 1,
      safest: 2,
    };
    options.sort((a, b) => orderPriority[a.typeTag] - orderPriority[b.typeTag]);

    return {
      routes: options,
      comparison,
      attribution: rawData.attribution,
    };
  },
};
