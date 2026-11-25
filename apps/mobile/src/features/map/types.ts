export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends Coordinates {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface SupportLocation {
  id: string;
  name: string;
  //type: "police" | "hospital" | "shelter";
  address?: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
}

export interface RiskZoneFeature {
  id: string;
  name: string;
  risk_level: "low" | "medium" | "high";
  center: Coordinates;
  radius_meters?: number;
  polygon_coordinates?: Coordinates[];
  reports_count?: number;
}

