import type { Coordinates } from "../map/types";

export interface RiskMapReport {
  category: string;
  description?: string | null;
  location: Coordinates;
  confirmations_count: number;
}

export interface ReportComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  parentId?: string;
  isMine?: boolean;
}

export interface DangerReport extends RiskMapReport {
  id: string;
  source?: "app" | "ssp";
  address: string;
  addressDetail: string;
  period: string;
  incidentDate?: string;
  incidentsCount?: number;
  isAnonymous: boolean;
  author: string;
  createdAt: string;
  confirmedByMe: boolean;
  comments: ReportComment[];
}

export interface CreateReportPayload {
  category: string;
  description: string;
  addressDetail: string;
  period: string;
  isAnonymous: boolean;

  location: Coordinates;
  address: string;
}

export const PERIOD_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
};

const CATEGORY_STYLES: Record<
  string,
  { color: string; background: string; symbol: string }
> = {
  Furto: {
    color: "#A16207",
    background: "#FFF3D7",
    symbol: "F",
  },
  Roubo: {
    color: "#EA580C",
    background: "#FFEDD5",
    symbol: "R",
  },
  Violência: {
    color: "#B4233D",
    background: "#FFE9EE",
    symbol: "!",
  },
  Assédio: {
    color: "#7443A5",
    background: "#F0E7FA",
    symbol: "!",
  },
  "Má iluminação": {
    color: "#356484",
    background: "#E6F2FA",
    symbol: "!",
  },
};

export function getCategoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      color: "#8055B5",
      background: "#F0EAF7",
      symbol: "!",
    }
  );
}

export function isValidCoordinates(
  coordinates: Coordinates,
) {
  return (
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    Math.abs(coordinates.latitude) <= 90 &&
    Math.abs(coordinates.longitude) <= 180
  );
}

export function coordinatesLabel(
  coordinates: Coordinates,
) {
  return [
    coordinates.latitude.toFixed(5),
    coordinates.longitude.toFixed(5),
  ].join(", ");
}

export function elapsed(iso: string) {
  const timestamp = Date.parse(iso);

  if (!Number.isFinite(timestamp)) return "Data indisponível";

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60000),
  );

  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  if (minutes < 1440) {
    return `Há ${Math.floor(minutes / 60)} h`;
  }

  const days = Math.floor(minutes / 1440);
  return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export const DEMO_CENTER: Coordinates = {
  latitude: -23.55052,
  longitude: -46.633308,
};

// Relatos fictícios para testar a integração no mapa.
export function createDemoReports(): DangerReport[] {
  const now = Date.now();

  return [
    {
      id: "demo-furto",
      category: "Furto",
      description:
        "Relato fictício: levaram minha mochila enquanto eu aguardava perto da praça.",
      location: {
        latitude: -23.5496,
        longitude: -46.635,
      },
      address: "Local de teste A · São Paulo",
      addressDetail: "Próximo à entrada da praça",
      period: "noite",
      isAnonymous: true,
      author: "Anônima",
      createdAt: new Date(now - 5 * 3600000).toISOString(),
      confirmations_count: 7,
      confirmedByMe: false,
      comments: [
        {
          id: "comment-1",
          author: "Marta",
          text: "Comentário de exemplo: a iluminação desse trecho está fraca.",
          createdAt: new Date(now - 3600000).toISOString(),
        },
      ],
    },
    {
      id: "demo-violencia",
      category: "Violência",
      description:
        "Relato fictício: uma agressão aconteceu perto do ponto de ônibus.",
      location: {
        latitude: -23.5515,
        longitude: -46.6317,
      },
      address: "Local de teste B · São Paulo",
      addressDetail: "Ponto de ônibus",
      period: "madrugada",
      isAnonymous: true,
      author: "Anônima",
      createdAt: new Date(now - 2 * 86400000).toISOString(),
      confirmations_count: 4,
      confirmedByMe: false,
      comments: [
        {
          id: "comment-2",
          author: "Gabi",
          text: "Comentário de exemplo: obrigada por compartilhar.",
          createdAt: new Date(now - 7200000).toISOString(),
        },
        {
          id: "reply-1",
          parentId: "comment-2",
          author: "Jane",
          text: "Resposta de exemplo: obrigada pelo apoio.",
          createdAt: new Date(now - 3600000).toISOString(),
        },
      ],
    },
  ];
}