import React from "react";
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "../src/theme";

/**
 * Rota Principal do Mapa Interativo (Navegação Anônima / Pública) - RF03, RF04, RF05, RF14.
 *
 * Exibida quando a usuária clica em "Acessar sem login" ou após autenticação.
 */
export default function MapHomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho com Acesso / Login */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>ProtegEla</Text>
          <Text style={styles.brandSubtitle}>São Paulo - Navegação Segura</Text>
        </View>
        <TouchableOpacity
          style={styles.loginButton}
          activeOpacity={0.8}
          onPress={() => router.push("/")}
        >
          <Text style={styles.loginButtonText}>Entrar</Text>
        </TouchableOpacity>
      </View>

      {/* Área Central: Placeholder Estrutural do Mapa Interativo (RF05) */}
      <View style={styles.mapContainer}>
        <Text style={styles.mapPlaceholderText}>
          Área do Mapa Interativo (OpenStreetMap / Overpass API)
        </Text>
        <Text style={styles.mapHelpText}>
          Camada de exibição de zonas de risco e rotas seguras (features/map).
        </Text>
      </View>

      {/* Barra Inferior com Ações e Botão de Pânico (RF14) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.panicButton}
          activeOpacity={0.85}
          accessibilityLabel="Botão de Pânico. Toque para acionar socorro imediato."
        >
          <Text style={styles.panicButtonText}>PÂNICO (SOS)</Text>
          <Text style={styles.panicSubtext}>Ligação para Emergência (RF14)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  brandTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  brandSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  loginButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.spacing.sm,
  },
  loginButtonText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  mapContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8EAF6",
    margin: theme.spacing.md,
    borderRadius: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  mapPlaceholderText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    textAlign: "center",
  },
  mapHelpText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: theme.spacing.xs,
  },
  bottomBar: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  panicButton: {
    backgroundColor: theme.colors.danger,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.spacing.md,
    alignItems: "center",
    elevation: 4,
    shadowColor: theme.colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  panicButtonText: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
  },
  panicSubtext: {
    color: "#FFCDD2",
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
});
