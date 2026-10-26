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
import { Button, Input, LinkText } from "../src/components/ui";

/**
 * Tela de Cadastro ("Criar conta")
 * Construída estritamente com os componentes reutilizáveis de src/components/ui/
 * e parâmetros da paleta do Figma (Fundo #E9E4F2, inputs #F8FAFC, botão #0F766E).
 */
export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados de erro para validação dupla no front
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const formatPhone = (text: string) => {
    // Máscara básica para telefone brasileiro (XX) XXXXX-XXXX
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const validateForm = (): boolean => {
    let isValid = true;
    setNameError("");
    setPhoneError("");
    setEmailError("");
    setPasswordError("");

    if (!name.trim()) {
      setNameError("Informe seu nome");
      isValid = false;
    }

    const rawPhone = phone.replace(/\D/g, "");
    if (!rawPhone) {
      setPhoneError("Informe seu telefone");
      isValid = false;
    } else if (rawPhone.length < 10) {
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

      if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        setPasswordError(
          "A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial (RN08)."
        );
        isValid = false;
      }
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      setTimeout(() => {
        setLoading(false);
        Alert.alert("Sucesso", "Conta criada com sucesso!", [
          { text: "OK", onPress: () => router.push("/") },
        ]);
      }, 800);
    } catch {
      setLoading(false);
      Alert.alert("Erro", "Falha ao criar conta. Tente novamente.");
    }
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
          <Text style={styles.title}>Criar conta</Text>
        </View>

        <View style={styles.formContainer}>
          <Input
            placeholder="Nome"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError("");
            }}
            autoCapitalize="words"
            error={nameError}
          />

          <Input
            placeholder="Telefone"
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
              onPress={() => router.push("/")}
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
    marginBottom: theme.spacing.xl,
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
  actionButtonContainer: {
    alignItems: "center",
    marginVertical: theme.spacing.lg,
  },
  registerButton: {
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
