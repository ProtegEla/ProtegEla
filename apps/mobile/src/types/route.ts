/**
 * Tipos de rotas seguras e zonas de risco (RF15, RN02, RN03, RN07).
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type RiskLevel = "MODERADO" | "ALTO" | "EXTREMO";

export interface RiskZonePolygon {
  id: string;
  polygon_coordinates: LatLng[];
  risk_score: number;
  risk_level: RiskLevel;
  updated_at: string;
}

export interface RouteStep {
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
}

export interface SafeRouteCalculation {
  fastest_route_duration_seconds: number;
  safe_route_duration_seconds: number;
  duration_difference_percent: number; // Alerta se > 30% (RN07)
  exceeds_threshold: boolean;
  geometry_geojson: unknown;
  steps: RouteStep[];
}
