import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import type { RouteOption } from "../../../services/api/routes";
import {
  computeNavigationProgress,
  formatDistanceMeters,
  formatDurationSeconds,
} from "../utils/navigationMath";

export const NAVIGATION_BACKGROUND_TASK = "PROTEGELA_ACTIVE_NAVIGATION_TASK";
const ACTIVE_NAV_STORAGE_KEY = "@protegela/active_navigation_state";
const NAVIGATION_CHANNEL_ID = "protegela-navigation";
const PERSISTENT_NOTIFICATION_ID = "protegela-active-nav";

interface PersistedNavigationState {
  routeId: string;
  destinationLabel: string;
  coordinates: RouteOption["coordinates"];
  steps: RouteOption["steps"];
  currentStepIndex: number;
}

export interface BackgroundNavigationResult {
  started: boolean;
  backgroundEnabled: boolean;
  message?: string;
}

// Configura exibição de notificações locais mesmo com o app em primeiro plano
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureNotificationChannelAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(NAVIGATION_CHANNEL_ID, {
    name: "Navegação Segura",
    importance: Notifications.AndroidImportance.LOW,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: null,
    enableVibrate: false,
  });
}

/**
 * Atualiza (ou cria) a notificação persistente na barra do celular com a instrução atual.
 */
export async function updatePersistentNavigationNotification(
  title: string,
  body: string
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await ensureNotificationChannelAsync();
    await Notifications.scheduleNotificationAsync({
      identifier: PERSISTENT_NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
        ...(Platform.OS === "android"
          ? { channelId: NAVIGATION_CHANNEL_ID }
          : {}),
      },
      trigger: null,
    });
  } catch {
    // Silencioso caso o usuário não tenha concedido permissão de notificação
  }
}

// Registra a tarefa em segundo plano no escopo global (exigência do Expo TaskManager)
if (Platform.OS !== "web" && !TaskManager.isTaskDefined(NAVIGATION_BACKGROUND_TASK)) {
  TaskManager.defineTask(NAVIGATION_BACKGROUND_TASK, async ({ data, error }) => {
    if (error || !data) return;

    const { locations } = data as { locations?: Location.LocationObject[] };
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    try {
      const raw = await AsyncStorage.getItem(ACTIVE_NAV_STORAGE_KEY);
      if (!raw) return;

      const state: PersistedNavigationState = JSON.parse(raw);
      const progress = computeNavigationProgress(
        {
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
        },
        state.steps,
        state.coordinates,
        state.currentStepIndex
      );

      if (progress.currentStepIndex !== state.currentStepIndex) {
        state.currentStepIndex = progress.currentStepIndex;
        await AsyncStorage.setItem(ACTIVE_NAV_STORAGE_KEY, JSON.stringify(state));
      }

      if (progress.arrived) {
        await updatePersistentNavigationNotification(
          "Você chegou ao destino",
          `${state.destinationLabel} • Rota segura concluída`
        );
        return;
      }

      const instruction =
        progress.currentStep?.instruction || `Siga rumo a ${state.destinationLabel}`;
      const distStr = formatDistanceMeters(progress.distanceToStepEndM);
      const remainingStr = `${formatDistanceMeters(progress.remainingDistanceM)} • ${formatDurationSeconds(progress.remainingDurationS)}`;

      await updatePersistentNavigationNotification(
        `Em ${distStr}: ${instruction}`,
        `Restante: ${remainingStr} • ${state.destinationLabel}`
      );
    } catch {
      // Evita crash em tarefa de segundo plano
    }
  });
}

/**
 * Inicia o rastreamento em segundo plano (Android/iOS) e fixa a notificação persistente (RF15 / RNF04).
 */
export async function startBackgroundNavigation(
  route: RouteOption,
  destinationLabel: string
): Promise<BackgroundNavigationResult> {
  if (Platform.OS === "web") {
    return { started: true, backgroundEnabled: false };
  }

  const persisted: PersistedNavigationState = {
    routeId: route.id,
    destinationLabel,
    coordinates: route.coordinates,
    steps: route.steps,
    currentStepIndex: 0,
  };
  await AsyncStorage.setItem(ACTIVE_NAV_STORAGE_KEY, JSON.stringify(persisted));

  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // Segue mesmo se permissão de notificação for negada
  }

  const firstStep = route.steps[0];
  const initialTitle = firstStep
    ? `Em ${formatDistanceMeters(firstStep.distanceM)}: ${firstStep.instruction}`
    : `Navegando para ${destinationLabel}`;
  const initialBody = `${route.distanceLabel} • ${route.durationLabel} (${route.riskBadgeLabel})`;

  await updatePersistentNavigationNotification(initialTitle, initialBody);

  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      return {
        started: true,
        backgroundEnabled: false,
        message: "Permissão de localização necessária para acompanhar a rota.",
      };
    }

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      return {
        started: true,
        backgroundEnabled: false,
        message:
          "Navegação iniciada em primeiro plano. Para continuar com a tela bloqueada, permita localização em segundo plano.",
      };
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      NAVIGATION_BACKGROUND_TASK
    );
    if (alreadyStarted) {
      await Location.stopLocationUpdatesAsync(NAVIGATION_BACKGROUND_TASK);
    }

    await Location.startLocationUpdatesAsync(NAVIGATION_BACKGROUND_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 4000,
      distanceInterval: 8,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "ProtegEla • Rota Segura Ativa",
        notificationBody: initialTitle,
        notificationColor: "#6A1B9A",
      },
    });

    return { started: true, backgroundEnabled: true };
  } catch {
    // Fallback gracioso (ex.: Expo Go sem permissão nativa de background)
    return {
      started: true,
      backgroundEnabled: false,
    };
  }
}

/**
 * Encerra o serviço de localização em segundo plano e remove a notificação persistente.
 */
export async function stopBackgroundNavigation(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await AsyncStorage.removeItem(ACTIVE_NAV_STORAGE_KEY);
    const isStarted = await Location.hasStartedLocationUpdatesAsync(
      NAVIGATION_BACKGROUND_TASK
    );
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(NAVIGATION_BACKGROUND_TASK);
    }
    await Notifications.dismissNotificationAsync(PERSISTENT_NOTIFICATION_ID);
  } catch {
    // Ignora erros ao encerrar
  }
}
