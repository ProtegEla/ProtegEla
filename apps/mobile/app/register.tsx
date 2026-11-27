import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { theme, useAppTheme } from "../src/theme";
import { Button, Input, LinkText } from "../src/components/ui";
import { useAuth } from "../src/features/auth/AuthContext";
import { authService } from "../src/services/api/auth";

/**
 * Tela de Cadastro ("Criar conta") - RF01.
 * 100% Responsiva e compatível com tema claro e escuro.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { login } = useAuth();

  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados de erro
  const [nicknameError, setNicknameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const validateForm = (): boolean => {
    let isValid = true;
    setNicknameError("");
    setPhoneError("");
    setEmailError("");
    setPasswordError("");

    if (!nickname.trim()) {
      setNicknameError("Informe um apelido");
      isValid = false;
    } else if (nickname.trim().length < 3) {
      setNicknameError("O apelido deve ter pelo menos 3 caracteres");
      isValid = false;
    }

    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone && rawPhone.length < 10) {
      setPhoneError("Telefone inválido");
      isValid = false;
    }

    if (!email.trim()) {
      setEmailError("Informe seu e-mail");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Digite um e-mail válido");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Crie uma senha");
      isValid = false;
    } else {
      const hasMinLength = password.length >= 8;
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[^A-Za-z0-9]/.test(password);

      const missing: string[] = [];
      if (!hasMinLength) missing.push("mínimo de 8 caracteres");
      if (!hasUpper) missing.push("1 letra maiúscula");
      if (!hasLower) missing.push("1 letra minúscula");
      if (!hasNumber) missing.push("1 número");
      if (!hasSpecial) missing.push("1 símbolo (ex: !@#$%)");

      if (missing.length > 0) {
        setPasswordError(`Senha inválida. Falta: ${missing.join(", ")}.`);
        isValid = false;
      }
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const normalizedEmail = email.trim();
      const normalizedName = nickname.trim();
      const rawPhone = phone.replace(/\D/g, "");
      await authService.register({
        username: normalizedName,
        email: normalizedEmail,
        password,
        emergency_contacts: rawPhone
          ? [
            {
              name: normalizedName,
              phone: rawPhone,
              is_primary: true,
            },
          ]
          : [],
      });
      await authService.login({ email: normalizedEmail, password });
      login(normalizedName, normalizedEmail);
      router.replace("/");
    } catch (error: any) {
      const details = Array.isArray(error?.details) ? error.details : [];
      let handledField = false;
      const fallbackIssues: string[] = [];

      for (const item of details) {
        const field = String(item?.field || "").toLowerCase();
        const rawIssue = String(item?.issue || item?.msg || "").trim();
        const issue = rawIssue.replace(/^Value error,\s*/i, "");
        if (!issue) continue;

        if (field.includes("username") || field.includes("nickname")) {
          setNicknameError(issue);
          handledField = true;
        } else if (field.includes("email")) {
          setEmailError(issue);
          handledField = true;
        } else if (field.includes("password")) {
          setPasswordError(issue);
          handledField = true;
        } else if (field.includes("phone") || field.includes("emergency_contacts")) {
          setPhoneError(issue);
          handledField = true;
        } else {
          fallbackIssues.push(issue);
        }
      }

      if (!handledField) {
        const msg =
          fallbackIssues.join(" ") ||
          error?.message ||
          "Não foi possível concluir o cadastro.";
        const lower = msg.toLowerCase();
        if (lower.includes("e-mail") || lower.includes("email")) {
          setEmailError(msg);
        } else if (lower.includes("apelido") || lower.includes("usuário") || lower.includes("username")) {
          setNicknameError(msg);
        } else {
          setPasswordError(msg);
        }
      }
    } finally {
      setLoading(false);
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
            <Text style={[styles.title, { color: colors.text }]}>Criar conta</Text>
          </View>

          <View style={styles.formContainer}>
            <Input
              placeholder="Apelido"
              value={nickname}
              onChangeText={(text) => {
                setNickname(text);
                if (nicknameError) setNicknameError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              error={nicknameError}
            />

            <Input
              placeholder="Contato de emergência (opcional)"
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhone(text));
                if (phoneError) setPhoneError("");
              }}
              keyboardType="phone-pad"
              maxLength={15}
              error={phoneError}
            />

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

            <View style={styles.actionButtonContainer}>
              <Button
                title="Cadastre-se"
                variant="primary"
                onPress={handleRegister}
                isLoading={loading}
                style={styles.registerButton}
              />
            </View>

            <View style={styles.footerContainer}>
              <LinkText
                text="Já tem conta?"
                actionText="Faça login!"
                underline={true}
                onPress={() => router.push("/login")}
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
  actionButtonContainer: {
    alignItems: "center",
    marginVertical: theme.spacing.md,
  },
  registerButton: {
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
