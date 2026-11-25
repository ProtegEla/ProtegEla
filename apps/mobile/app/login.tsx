import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme, useAppTheme } from "../src/theme";
import { Button, Input, Checkbox, LinkText } from "../src/components/ui";

import { useAuthActions } from "../src/features/auth/useAuthActions";
import { normalizeApiError } from "../src/services/api/client";
/**
 * Tela de Login ("Bem-vinda!") - RF02.
 * 100% Responsiva para qualquer tamanho de tela ou celular.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn, forgotPassword } = useAuthActions();

const params = useLocalSearchParams<{ registered?: string }>();
const busyRef = useRef(false);

const [formError, setFormError] = useState("");
const [message, setMessage] = useState("");
const [recovering, setRecovering] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados de erro
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
    if (busyRef.current || !validateForm()) return;

    busyRef.current = true;
    setLoading(true);
    setFormError("");
    setMessage("");

    try {
      await signIn(email.trim(), password);

      // Só navega depois de autenticar e salvar os tokens.
      router.replace("/");
    } catch (error) {
      setFormError(normalizeApiError(error).message);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (busyRef.current) return;

    const cleanEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError("Informe um e-mail válido para recuperar a senha.");
      return;
    }

    busyRef.current = true;
    setRecovering(true);
    setFormError("");
    setMessage("");

    try {
      await forgotPassword(cleanEmail);

      setMessage(
        "Se houver uma conta para este e-mail, você receberá as instruções de recuperação.",
      );
    } catch (error) {
      setFormError(normalizeApiError(error).message);
    } finally {
      busyRef.current = false;
      setRecovering(false);
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
            {params.registered === "1" && (
              <Text style={{ color: colors.text, marginBottom: 16 }}>
                Conta criada! Entre com seu e-mail e senha.
              </Text>
            )}

            {!!formError && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.danger, marginBottom: 16 }}
              >
                {formError}
              </Text>
            )}

            {!!message && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.text, marginBottom: 16 }}
              >
                {message}
              </Text>
            )}
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
                text={recovering ? "Enviando instruções…" : "Esqueceu a senha?"}
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
});

