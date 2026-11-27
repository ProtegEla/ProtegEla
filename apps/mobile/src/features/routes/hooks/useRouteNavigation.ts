import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { RouteCoordinate, RouteOption } from "../../../services/api/routes";
import {
  computeNavigationProgress,
  formatDistanceMeters,
  formatDurationSeconds,
  type NavigationProgress,
} from "../utils/navigationMath";
import {
  startBackgroundNavigation,
  stopBackgroundNavigation,
  updatePersistentNavigationNotification,
} from "../services/backgroundNavigation";

interface UseRouteNavigationOptions {
  currentLocation: RouteCoordinate | null;
  onFollowLocation?: (coords: RouteCoordinate) => void;
}

export function useRouteNavigation({
  currentLocation,
  onFollowLocation,
}: UseRouteNavigationOptions) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [destinationLabel, setDestinationLabel] = useState("");
  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null);

  const stepIndexRef = useRef(0);
  const lastNotifiedStepRef = useRef(-1);

  const startNavigation = useCallback(
    async (route: RouteOption, destLabel: string) => {
      stepIndexRef.current = 0;
      lastNotifiedStepRef.current = -1;

      const initialPos = currentLocation ?? route.coordinates[0];
      const initialProgress = initialPos
        ? computeNavigationProgress(
            initialPos,
            route.steps,
            route.coordinates,
            0
          )
        : null;

      setActiveRoute(route);
      setDestinationLabel(destLabel);
      setProgress(initialProgress);
      setBackgroundNotice(null);
      setIsNavigating(true);

      if (initialPos && onFollowLocation) {
        onFollowLocation(initialPos);
      }

      const bgResult = await startBackgroundNavigation(route, destLabel);
      if (bgResult.message) {
        setBackgroundNotice(bgResult.message);
      }
    },
    [currentLocation, onFollowLocation]
  );

  const stopNavigation = useCallback(async () => {
    setIsNavigating(false);
    setActiveRoute(null);
    setDestinationLabel("");
    setProgress(null);
    setBackgroundNotice(null);
    stepIndexRef.current = 0;
    lastNotifiedStepRef.current = -1;
    await stopBackgroundNavigation();
  }, []);

  // Atualiza progresso em tempo real conforme o GPS muda
  useEffect(() => {
    if (!isNavigating || !activeRoute || !currentLocation) return;

    const nextProgress = computeNavigationProgress(
      currentLocation,
      activeRoute.steps,
      activeRoute.coordinates,
      stepIndexRef.current
    );

    stepIndexRef.current = nextProgress.currentStepIndex;
    setProgress(nextProgress);

    if (onFollowLocation) {
      onFollowLocation(currentLocation);
    }

    // Mantém a notificação fixa do celular sincronizada quando avança de passo ou chega
    if (Platform.OS !== "web") {
      if (nextProgress.arrived) {
        void updatePersistentNavigationNotification(
          "Você chegou ao destino",
          `${destinationLabel} • Rota segura concluída`
        );
      } else if (lastNotifiedStepRef.current !== nextProgress.currentStepIndex) {
        lastNotifiedStepRef.current = nextProgress.currentStepIndex;
        const instruction =
          nextProgress.currentStep?.instruction ||
          `Siga rumo a ${destinationLabel}`;
        const distStr = formatDistanceMeters(nextProgress.distanceToStepEndM);
        const remainingStr = `${formatDistanceMeters(nextProgress.remainingDistanceM)} • ${formatDurationSeconds(nextProgress.remainingDurationS)}`;
        void updatePersistentNavigationNotification(
          `Em ${distStr}: ${instruction}`,
          `Restante: ${remainingStr} • ${destinationLabel}`
        );
      }
    }
  }, [
    isNavigating,
    activeRoute,
    currentLocation?.latitude,
    currentLocation?.longitude,
    destinationLabel,
    onFollowLocation,
  ]);

  // Garante limpeza do serviço em segundo plano ao desmontar
  useEffect(() => {
    return () => {
      void stopBackgroundNavigation();
    };
  }, []);

  return {
    isNavigating,
    activeRoute,
    destinationLabel,
    progress,
    backgroundNotice,
    startNavigation,
    stopNavigation,
  };
}
