import { apiClient, ApiError } from "./client";
import type { Schemas } from "./contracts";

export const authService = {
  async login(
    payload: Schemas["LoginRequest"],
  ): Promise<Schemas["LoginResponse"]> {
    const response = await apiClient.post<Schemas["LoginResponse"]>(
      "/auth/login",
      payload,
    );

    // Os endpoints de autenticação não usam envelope { data: ... }.
    const tokens = response.data;

    if (
      typeof tokens?.access_token !== "string" ||
      !tokens.access_token.trim() ||
      typeof tokens.refresh_token !== "string" ||
      !tokens.refresh_token.trim()
    ) {
      throw new ApiError("O servidor retornou uma sessão inválida.");
    }

    return tokens;
  },

  async register(
    payload: Schemas["RegisterRequest"],
  ): Promise<Schemas["RegisterResponse"]> {
    const response = await apiClient.post<Schemas["RegisterResponse"]>(
      "/auth/register",
      payload,
    );

    return response.data;
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post("/auth/forgot-password", { email });
  },
};