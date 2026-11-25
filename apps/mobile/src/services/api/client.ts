import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { secureStore } from "../../storage/secureStore";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "UNKNOWN_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status_code() {
    return this.status;
  }

  // Compatibilidade com consumidores do envelope anterior.
  get error() {
    return {
      code: this.code,
      message: this.message,
      status_code: this.status,
      details: this.details,
    };
  }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (!axios.isAxiosError(error)) {
    return new ApiError(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação.",
    );
  }

  if (!error.response) {
    return new ApiError(
      "Não foi possível conectar ao servidor. Verifique sua conexão.",
      0,
      "NETWORK_ERROR",
    );
  }

  const body = object(error.response.data);
  const nested = object(body.error);
  const detail = object(body.detail);

  const payload = Object.keys(nested).length
    ? nested
    : Object.keys(detail).length
      ? detail
      : body;

  const message =
    typeof payload.message === "string"
      ? payload.message
      : typeof body.detail === "string"
        ? body.detail
        : error.response.status === 401
          ? "Faça login para continuar."
          : error.response.status === 422
            ? "Confira os campos informados."
            : `Não foi possível concluir a operação (HTTP ${error.response.status}).`;

  return new ApiError(
    message,
    error.response.status,
    typeof payload.code === "string"
      ? payload.code
      : "HTTP_ERROR",
    payload.details ?? body.detail,
  );
}

const DEVICE_KEY = "@protegela:device_id";

const UUID4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let devicePromise: Promise<string> | null = null;

// Este ID identifica o dispositivo para rate limit.
// Ele não substitui a autenticação.
function makeDeviceId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (token) => {
      const value = Math.floor(Math.random() * 16);

      return (
        token === "x" ? value : (value & 3) | 8
      ).toString(16);
    },
  );
}

export function getOrCreateDeviceId(): Promise<string> {
  if (!devicePromise) {
    devicePromise = (async () => {
      const existing = await AsyncStorage.getItem(DEVICE_KEY);

      if (existing && UUID4.test(existing)) return existing;

      const id = makeDeviceId();
      await AsyncStorage.setItem(DEVICE_KEY, id);

      return id;
    })().catch((error) => {
      devicePromise = null;
      throw error;
    });
  }

  return devicePromise;
}

export async function requireAccessToken() {
  const token = await secureStore.getAccessToken();

  if (!token) {
    throw new ApiError(
      "Faça login para continuar.",
      401,
      "UNAUTHORIZED",
    );
  }
}

export const apiClient = axios.create({
  baseURL:
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "http://localhost:8000/api/v1",
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await secureStore
    .getAccessToken()
    .catch(() => null);

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    config.headers.set(
      "X-Device-Id",
      await getOrCreateDeviceId(),
    );
  } catch {
    const isCreatingReport =
      config.method?.toLowerCase() === "post" &&
      config.url?.replace(/\/$/, "") === "/reports";

    if (isCreatingReport) {
      throw new ApiError(
        "Não foi possível identificar o dispositivo para publicar.",
        0,
        "DEVICE_ID_UNAVAILABLE",
      );
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    return Promise.reject(normalizeApiError(error));
  },
);