import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { theme, useAppTheme } from "../src/theme";
import { Button, Input, Checkbox, LinkText } from "../src/components/ui";
import { useAuth } from "../src/features/auth/AuthContext";
import { authService } from "../src/services/api/auth";

/**
 * Tela de Login ("Bem-vinda!") - RF02.
 * 100% Responsiva para qualquer tamanho de tela ou celular.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados de erro
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Recuperação de senha
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "reset">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");

    if (!email.trim()) {
      setEmailError("Informe seu e-mail");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Digite um e-mail válido");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Informe sua senha");
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const normalizedEmail = email.trim();
      await authService.login({ email: normalizedEmail, password });
      const fallbackNickname = normalizedEmail.split("@")[0] || "Usuária";
      login(fallbackNickname, normalizedEmail);
      router.replace("/");
    } catch (error: any) {
      const details = Array.isArray(error?.details) ? error.details : [];
      let handledField = false;

      for (const item of details) {
        const field = String(item?.field || "").toLowerCase();
        const rawIssue = String(item?.issue || item?.msg || "").trim();
        const issue = rawIssue.replace(/^Value error,\s*/i, "");
        if (!issue) continue;

        if (field.includes("email")) {
          setEmailError(issue);
          handledField = true;
        } else if (field.includes("password")) {
          setPasswordError(issue);
          handledField = true;
        }
      }

      if (!handledField) {
        const msg =
          error?.message || "E-mail ou senha inválidos. Tente novamente.";
        setPasswordError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setForgotEmail(email.trim());
    setResetToken("");
    setResetNewPassword("");
    setForgotMessage("");
    setForgotError("");
    setForgotStep("email");
    setIsForgotOpen(true);
  };

  const handleSendResetEmail = async () => {
    const trimmed = forgotEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setForgotError("Digite um e-mail válido.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");
    try {
      const res = await authService.forgotPassword(trimmed);
      setForgotMessage(
        res?.message ||
        "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
      );
      setForgotStep("reset");
    } catch (error: any) {
      setForgotError(
        error?.message || "Não foi possível enviar o e-mail de recuperação."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!resetToken.trim()) {
      setForgotError("Informe o token recebido por e-mail.");
      return;
    }
    if (resetNewPassword.length < 8) {
      setForgotError(
        "A nova senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo."
      );
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");
    try {
      const res = await authService.resetPassword(
        resetToken.trim(),
        resetNewPassword
      );
      Alert.alert(
        "Senha redefinida",
        res?.message || "Sua senha foi alterada com sucesso."
      );
      setIsForgotOpen(false);
    } catch (error: any) {
      const details = Array.isArray(error?.details) ? error.details : [];
      const firstIssue = details[0]?.issue
        ? String(details[0].issue).replace(/^Value error,\s*/i, "")
        : "";
      setForgotError(
        firstIssue || error?.message || "Não foi possível redefinir a senha."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.keyboardView, { backgroundColor: colors.screenBackground }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveWrapper}>
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Bem-vinda!</Text>
          </View>

          <View style={styles.formContainer}>
            <Input
              placeholder="E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={emailError}
            />

            <Input
              placeholder="Senha"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError("");
              }}
              secureTextEntry
              autoCapitalize="none"
              error={passwordError}
            />

            <View style={styles.optionsRow}>
              <LinkText
                text="Esqueceu a senha?"
                underline={false}
                align="left"
                textStyle={[styles.forgotPasswordText, { color: colors.textMuted }]}
                onPress={handleForgotPassword}
              />
            </View>

            <View style={styles.checkboxContainer}>
              <Checkbox
                label="Lembrar de mim"
                checked={rememberMe}
                onToggle={setRememberMe}
              />
            </View>

            <View style={styles.actionButtonContainer}>
              <Button
                title="Login"
                variant="primary"
                onPress={handleLogin}
                isLoading={loading}
                style={styles.loginButton}
              />
            </View>

            <View style={styles.footerContainer}>
              <LinkText
                text="Não tem conta?"
                actionText="Cadastre-se"
                underline={true}
                onPress={() => router.push("/register")}
              />

              <View style={styles.backSpacing} />

              <LinkText
                text="Voltar ao mapa"
                underline={false}
                onPress={() => router.push("/")}
                textStyle={[styles.backToMapText, { color: colors.textMuted }]}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isForgotOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsForgotOpen(false)}
      >
        <View style={styles.forgotBackdrop}>
          <View
            style={[
              styles.forgotCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.forgotHeader}>
              <Text style={[styles.forgotTitle, { color: colors.text }]}>
                Recuperar senha
              </Text>
              <TouchableOpacity onPress={() => setIsForgotOpen(false)}>
                <Text style={[styles.forgotClose, { color: colors.textMuted }]}>
                  X
                </Text>
              </TouchableOpacity>
            </View>

            {forgotStep === "email" ? (
              <>
                <Text style={[styles.forgotHint, { color: colors.textMuted }]}>
                  Informe seu e-mail cadastrado para receber o token de redefinição.
                </Text>
                <Input
                  placeholder="E-mail"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!forgotError && (
                  <Text style={styles.forgotErrorText}>{forgotError}</Text>
                )}
                <Button
                  title="Enviar e-mail"
                  variant="primary"
                  onPress={handleSendResetEmail}
                  isLoading={forgotLoading}
                />
                <View style={{ marginTop: 10 }}>
                  <LinkText
                    text="Já tenho um token"
                    underline
                    onPress={() => {
                      setForgotError("");
                      setForgotStep("reset");
                    }}
                  />
                </View>
              </>
            ) : (
              <>
                {!!forgotMessage && (
                  <Text style={styles.forgotSuccessText}>{forgotMessage}</Text>
                )}
                <Input
                  placeholder="Token recebido por e-mail"
                  value={resetToken}
                  onChangeText={setResetToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Input
                  placeholder="Nova senha"
                  value={resetNewPassword}
                  onChangeText={setResetNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                {!!forgotError && (
                  <Text style={styles.forgotErrorText}>{forgotError}</Text>
                )}
                <Button
                  title="Redefinir senha"
                  variant="primary"
                  onPress={handleConfirmResetPassword}
                  isLoading={forgotLoading}
                />
                <View style={{ marginTop: 10 }}>
                  <LinkText
                    text="Reenviar e-mail"
                    underline
                    onPress={() => {
                      setForgotError("");
                      setForgotStep("email");
                    }}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  responsiveWrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.extrabold,
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  optionsRow: {
    alignItems: "flex-start",
    marginBottom: theme.spacing.xs,
  },
  forgotPasswordText: {
    fontSize: theme.typography.sizes.xs,
  },
  checkboxContainer: {
    marginBottom: theme.spacing.lg,
  },
  actionButtonContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  loginButton: {
    width: "100%",
    maxWidth: 240,
    minHeight: 52,
  },
  footerContainer: {
    alignItems: "center",
    marginTop: theme.spacing.xs,
  },
  backSpacing: {
    height: theme.spacing.md,
  },
  backToMapText: {
    fontSize: theme.typography.sizes.sm,
  },
  forgotBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 10, 26, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  forgotCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  forgotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  forgotClose: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  forgotHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  forgotErrorText: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 10,
  },
  forgotSuccessText: {
    color: "#10B981",
    fontSize: 12,
    marginBottom: 10,
  },
});

