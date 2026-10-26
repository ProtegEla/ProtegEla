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
import { theme } from "../src/theme";
import { Button, Input, Checkbox, LinkText } from "../src/components/ui";

/**
 * Tela de Login ("Bem-vinda!")
 * Construída estritamente com os componentes reutilizáveis de src/components/ui/
 * e parâmetros da paleta do Figma (Fundo #E9E4F2, inputs #F8FAFC, botão #0F766E).
 */
export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados de erro para validação dupla no front
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
    } else if (password.length < 6) {
      setPasswordError("A senha deve ter ao menos 6 caracteres");
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Simulação / chamada futura ao serviço de autenticação
      setTimeout(() => {
        setLoading(false);
        Alert.alert("Sucesso", "Login efetuado com sucesso!");
      }, 800);
    } catch {
      setLoading(false);
      Alert.alert("Erro", "Falha ao realizar login. Tente novamente.");
    }
  };

  const handleForgotPassword = () => {
    Alert.alert("Recuperar Senha", "Instruções serão enviadas para o seu e-mail.");
  };

  const handleAnonymousAccess = () => {
    router.push("/map");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Bem-vinda!</Text>
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
              textStyle={styles.forgotPasswordText}
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

            <View style={styles.anonymousSpacing} />

            <LinkText
              text="Acessar sem login"
              underline={false}
              onPress={handleAnonymousAccess}
              textStyle={styles.anonymousText}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: theme.colors.screenBackground,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.extrabold,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
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
    color: theme.colors.textMuted,
  },
  checkboxContainer: {
    marginBottom: theme.spacing.xl,
  },
  actionButtonContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  loginButton: {
    width: "60%",
    minHeight: 52,
  },
  footerContainer: {
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  anonymousSpacing: {
    height: theme.spacing.lg,
  },
  anonymousText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
});
