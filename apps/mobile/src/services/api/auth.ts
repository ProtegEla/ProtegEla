import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { Schemas } from "./contracts";
import { secureStore } from "../../storage/secureStore";

export const authService = {
  async login(payload: Schemas["LoginRequest"]): Promise<Schemas["LoginResponse"]> {
    const response = await apiClient.post<Schemas["LoginResponse"]>(
      ENDPOINTS.AUTH.LOGIN,
      payload
    );
    const { access_token, refresh_token } = response.data;
    if (access_token) await secureStore.setAccessToken(access_token);
    if (refresh_token) await secureStore.setRefreshToken(refresh_token);
    return response.data;
  },

  async register(
    payload: Schemas["RegisterRequest"]
  ): Promise<Schemas["RegisterResponse"]> {
    const response = await apiClient.post<Schemas["RegisterResponse"]>(
      ENDPOINTS.AUTH.REGISTER,
      payload
    );
    return response.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { email }
    );
    return response.data;
  },

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      ENDPOINTS.AUTH.RESET_PASSWORD,
      { token, new_password: newPassword }
    );
    return response.data;
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      ENDPOINTS.AUTH.CHANGE_PASSWORD,
      { current_password: currentPassword, new_password: newPassword }
    );
    return response.data;
  },

  async logout(): Promise<void> {
    await secureStore.clearTokens();
  },
};
