import { useAuth } from "./AuthContext";
import { authService } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";
import { secureStore } from "../../storage/secureStore";

export function useAuthActions() {
  const { login } = useAuth();

  async function signIn(email: string, password: string) {
    const cleanEmail = email.trim();

    const tokens = await authService.login({
      email: cleanEmail,
      password,
    });

    try {
      await secureStore.setRefreshToken(tokens.refresh_token);
      await secureStore.setAccessToken(tokens.access_token);
    } catch {
      await secureStore.clearTokens().catch(() => undefined);

      throw new ApiError(
        "Não foi possível salvar a sessão. Tente novamente.",
      );
    }

    // A API de login não retorna username.
    // O prefixo do e-mail serve somente como identificação visual local.
    await login(cleanEmail.split("@")[0], cleanEmail);
  }

  return {
    signIn,
    signUp: authService.register,
    forgotPassword: authService.forgotPassword,
  };
}