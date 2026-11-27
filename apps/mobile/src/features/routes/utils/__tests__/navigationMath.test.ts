import {
  computeNavigationProgress,
  formatDistanceMeters,
  getManeuverIconName,
  haversineMeters,
} from "../navigationMath";
import type { RouteStep } from "../../../../services/api/routes";

describe("navigationMath", () => {
  const coords = [
    { latitude: -23.5505, longitude: -46.6333 },
    { latitude: -23.5515, longitude: -46.6333 },
    { latitude: -23.5515, longitude: -46.6323 },
  ];

  const steps: RouteStep[] = [
    {
      instruction: "Siga em frente na Rua A",
      distanceM: 111,
      durationS: 80,
      wayPoints: [0, 1],
      targetCoordinate: coords[1],
    },
    {
      instruction: "Vire à esquerda na Rua B",
      distanceM: 102,
      durationS: 75,
      wayPoints: [1, 2],
      targetCoordinate: coords[2],
    },
  ];

  it("formata distâncias em metros e quilômetros", () => {
    expect(formatDistanceMeters(85)).toBe("85 m");
    expect(formatDistanceMeters(1450)).toBe("1,5 km");
  });

  it("identifica ícones de manobra a partir da instrução", () => {
    expect(getManeuverIconName("Vire à esquerda na Rua B")).toBe("arrow-back");
    expect(getManeuverIconName("Vire à direita na Av. Paulista")).toBe("arrow-forward");
    expect(getManeuverIconName("Siga em frente")).toBe("arrow-up");
    expect(getManeuverIconName("Você chegou ao destino")).toBe("flag");
  });

  it("avança automaticamente para o próximo passo ao atingir o ponto de manobra", () => {
    const atStart = computeNavigationProgress(coords[0], steps, coords, 0);
    expect(atStart.currentStepIndex).toBe(0);
    expect(atStart.arrived).toBe(false);
    expect(atStart.nextStep?.instruction).toBe("Vire à esquerda na Rua B");

    const nearTurn = computeNavigationProgress(coords[1], steps, coords, 0);
    expect(nearTurn.currentStepIndex).toBe(1);
    expect(nearTurn.currentStep?.instruction).toBe("Vire à esquerda na Rua B");
    expect(nearTurn.arrived).toBe(false);

    const atDestination = computeNavigationProgress(coords[2], steps, coords, 1);
    expect(atDestination.arrived).toBe(true);
    expect(atDestination.remainingDistanceM).toBe(0);
    expect(haversineMeters(coords[0], coords[0])).toBe(0);
  });
});
