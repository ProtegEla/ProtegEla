import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme, useAppTheme } from "../../theme";

export type BottomNavTab = "delegacias" | "telefones" | "orientacoes" | "emergencia";

export interface BottomNavigationProps {
  activeTab?: BottomNavTab;
  onTabPress?: (tab: BottomNavTab) => void;
  onPanicPress?: () => void;
  containerStyle?: ViewStyle;
}

/**
 * Barra Inferior de Navegação e Botão de Emergência (RF10, RF11, RF12, RF14).
 * Responsiva, acessível e sincronizada com o tema (claro/escuro).
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabPress,
  onPanicPress,
  containerStyle,
}) => {
  const { colors } = useAppTheme();

  const handlePress = (tab: BottomNavTab) => {
    if (tab === "emergencia" && onPanicPress) {
      onPanicPress();
      return;
    }
    onTabPress?.(tab);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bottomBarBackground,
          borderTopColor: colors.bottomBarBorder,
        },
        containerStyle,
      ]}
    >
      {/* Delegacias (RF12) */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => handlePress("delegacias")}
        accessibilityLabel="Consultar delegacias próximas"
      >
        <View style={[styles.purpleCircle, { backgroundColor: colors.primaryPurple }]}>
          <MaterialCommunityIcons name="shield-star" size={22} color="#FFFFFF" />
        </View>
        <Text style={[styles.label, { color: colors.primaryPurple }]}>Delegacias</Text>
      </TouchableOpacity>

      {/* Telefones Úteis (RF10) */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => handlePress("telefones")}
        accessibilityLabel="Consultar telefones úteis como 180 e 190"
      >
        <View style={[styles.purpleCircle, { backgroundColor: colors.primaryPurple }]}>
          <Ionicons name="call" size={19} color="#FFFFFF" />
        </View>
        <Text style={[styles.label, { color: colors.primaryPurple }]}>Telefones</Text>
      </TouchableOpacity>

      {/* Orientações e Dicas de Segurança (RF11) */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.7}
        onPress={() => handlePress("orientacoes")}
        accessibilityLabel="Orientações e dicas de segurança"
      >
        <View style={[styles.purpleCircle, { backgroundColor: colors.primaryPurple }]}>
          <Ionicons name="information" size={21} color="#FFFFFF" />
        </View>
        <Text style={[styles.label, { color: colors.primaryPurple }]}>Orientações</Text>
      </TouchableOpacity>

      {/* Botão de Emergência / Pânico (RF14) */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.75}
        onPress={() => handlePress("emergencia")}
        accessibilityLabel="Botão de Pânico e Emergência"
      >
        <View style={styles.redCircle}>
          <MaterialCommunityIcons name="alarm-light" size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.redLabel}>Emergência</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 2,
  },
  purpleCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
  },
  redCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  redLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: "#DC2626",
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
  },
});
