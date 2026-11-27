import type { RouteCoordinate, RouteStep } from "../../../services/api/routes";

export interface NavigationProgress {
  currentStepIndex: number;
  currentStep: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToStepEndM: number;
  remainingDistanceM: number;
  remainingDurationS: number;
  arrived: boolean;
}

const EARTH_RADIUS_M = 6_371_008.8;
const STEP_ADVANCE_THRESHOLD_M = 22;
const ARRIVAL_THRESHOLD_M = 25;

/**
 * Calcula a distância em metros entre duas coordenadas (fórmula de Haversine).
 */
export function haversineMeters(a: RouteCoordinate, b: RouteCoordinate): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Formata distância em metros para exibição amigável ("45 m", "1,2 km").
 */
export function formatDistanceMeters(meters: number): string {
  const safe = Math.max(0, Math.round(meters));
  if (safe < 1000) {
    return `${safe} m`;
  }
  const km = Math.round(safe / 100) / 10;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * Formata duração em segundos para minutos ("1 min", "14 min").
 */
export function formatDurationSeconds(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

/**
 * Retorna o nome do ícone Ionicons correspondente à instrução de manobra em português.
 */
export function getManeuverIconName(
  instruction: string
): "arrow-up" | "arrow-back" | "arrow-forward" | "return-up-back" | "flag" {
  const text = instruction
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (text.includes("chegou") || text.includes("destino")) {
    return "flag";
  }
  if (text.includes("retorno") || text.includes("meia-volta") || text.includes("meia volta")) {
    return "return-up-back";
  }
  if (text.includes("esquerda")) {
    return "arrow-back";
  }
  if (text.includes("direita")) {
    return "arrow-forward";
  }
  return "arrow-up";
}

/**
 * Calcula o progresso atual da usuária ao longo dos passos da rota.
 * Avança o passo apenas para frente (ou mantém o atual) para evitar saltos por oscilação de GPS.
 */
export function computeNavigationProgress(
  userPosition: RouteCoordinate,
  steps: RouteStep[],
  routeCoordinates: RouteCoordinate[],
  previousStepIndex: number
): NavigationProgress {
  const destination =
    routeCoordinates[routeCoordinates.length - 1] ??
    steps[steps.length - 1]?.targetCoordinate;

  if (!destination || steps.length === 0) {
    const dist = destination ? haversineMeters(userPosition, destination) : 0;
    return {
      currentStepIndex: 0,
      currentStep: null,
      nextStep: null,
      distanceToStepEndM: dist,
      remainingDistanceM: dist,
      remainingDurationS: Math.round(dist / 1.35),
      arrived: dist <= ARRIVAL_THRESHOLD_M,
    };
  }

  const distToDestination = haversineMeters(userPosition, destination);
  if (distToDestination <= ARRIVAL_THRESHOLD_M) {
    const lastIdx = steps.length - 1;
    return {
      currentStepIndex: lastIdx,
      currentStep: steps[lastIdx],
      nextStep: null,
      distanceToStepEndM: 0,
      remainingDistanceM: 0,
      remainingDurationS: 0,
      arrived: true,
    };
  }

  let stepIndex = Math.min(Math.max(0, previousStepIndex), steps.length - 1);

  // Avança passos sequencialmente quando a usuária já atingiu o fim do segmento atual
  while (stepIndex < steps.length - 1) {
    const target = steps[stepIndex].targetCoordinate;
    const distToEnd = haversineMeters(userPosition, target);
    if (distToEnd <= STEP_ADVANCE_THRESHOLD_M) {
      stepIndex += 1;
    } else {
      break;
    }
  }

  const currentStep = steps[stepIndex];
  const nextStep = stepIndex + 1 < steps.length ? steps[stepIndex + 1] : null;
  const distanceToStepEndM = haversineMeters(
    userPosition,
    currentStep.targetCoordinate
  );

  let remainingDistanceM = distanceToStepEndM;
  let remainingDurationS =
    currentStep.distanceM > 0
      ? currentStep.durationS * Math.min(1, distanceToStepEndM / currentStep.distanceM)
      : 0;

  for (let i = stepIndex + 1; i < steps.length; i += 1) {
    remainingDistanceM += steps[i].distanceM;
    remainingDurationS += steps[i].durationS;
  }

  return {
    currentStepIndex: stepIndex,
    currentStep,
    nextStep,
    distanceToStepEndM,
    remainingDistanceM,
    remainingDurationS,
    arrived: false,
  };
}
