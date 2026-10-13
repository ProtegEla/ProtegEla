import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { secureStore } from "../../storage/secureStore";
import { localStorage } from "../../storage/localStorage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

/**
 * Cliente HTTP centralizado do aplicativo móvel.
 *
 * Garante que nenhuma tela realize chamadas HTTP diretas desordenadas.
 * Anexa automaticamente JWT ou X-Device-Id e intercepta timeouts e erros (RFC 7807).
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000, // Timeout padrão de 8s (docs/api_contracts.md)
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor de Requisição: Adiciona Token ou Identificador Anônimo
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await secureStore.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Usuária anônima / acesso sem login (RF04)
        const deviceId = await localStorage.getOrCreateDeviceId();
        config.headers["X-Device-Id"] = deviceId;
      }
    } catch {
      // Falha ao obter tokens não deve travar a requisição pública
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Resposta: Tratamento de Erros e Resiliência
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.code === "ECONNABORTED" || !error.response) {
      // Erro de rede ou timeout
      return Promise.reject({
        code: "NETWORK_ERROR",
        message: "Não foi possível conectar ao servidor. Verifique sua conexão.",
      });
    }

    // Retorna erro estruturado conforme envelope da API
    const serverError = error.response.data;
    return Promise.reject(serverError || error);
  }
);
