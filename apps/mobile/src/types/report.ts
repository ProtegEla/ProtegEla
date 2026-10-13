/**
 * Tipos e categorias de relatos colaborativos (RF07, RF09).
 */

export enum ReportCategory {
  ASSEDIO = "Assédio",
  VIOLENCIA = "Violência",
  FURTO = "Furto",
  MA_ILUMINACAO = "Má iluminação",
}

export interface ReportLocation {
  latitude: number;
  longitude: number;
  address_reference?: string;
}

export interface Report {
  id: string;
  category: ReportCategory;
  description?: string;
  location: ReportLocation;
  incident_date: string;
  incident_period: "manha" | "tarde" | "noite" | "madrugada";
  is_anonymous: boolean;
  confirmations_count: number;
  abuse_reports_count: number;
  is_hidden: boolean; // Ocultado se abuse_reports > 30% das confirmações (RN06)
  created_at: string;
  author_username?: string;
}
