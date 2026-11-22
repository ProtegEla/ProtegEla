import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../../theme";

export interface RoutePlanningBarProps {
  originLabel?: string;
  destinationLabel: string;
  onClose: () => void;
  onEditDestination: () => void;
  onStartRoute: () => void;
}

export const RoutePlanningBar: React.FC<RoutePlanningBarProps> = ({
  originLabel = "Localização Atual",
  destinationLabel,
  onClose,
  onEditDestination,
  onStartRoute,
}) => {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      {/* Card Flutuante de Origem e Destino (Imagem 2) */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.surface : "#F1ECF9",
            borderColor: isDark ? colors.border : "#E2D9F3",
          },
        ]}
      >
        {/* Linha de Origem */}
        <View style={styles.pointRow}>
          <View style={styles.dotContainer}>
            <View style={[styles.purpleDot, { backgroundColor: colors.primaryPurple }]} />
          </View>
          <Text
            style={[styles.pointText, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {originLabel}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.actionBtn}
            accessibilityLabel="Fechar modo rota"
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Linha vertical conectora com seta para baixo */}
        <View style={styles.connectorRow}>
          <View style={styles.connectorLineContainer}>
            <Ionicons name="arrow-down" size={14} color={colors.primaryPurple} />
          </View>
          <View style={styles.dashedDivider} />
        </View>

        {/* Linha de Destino */}
        <View style={styles.pointRow}>
          <View style={styles.dotContainer}>
            <View style={[styles.purpleDot, { backgroundColor: colors.primaryPurple }]} />
          </View>
          <Text
            style={[styles.pointText, { color: colors.text, fontWeight: "600" }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {destinationLabel}
          </Text>
          <TouchableOpacity
            onPress={onEditDestination}
            style={styles.actionBtn}
            accessibilityLabel="Alterar destino"
          >
            <MaterialCommunityIcons name="pencil" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Botão Flutuante Iniciar Rota (Imagem 2) */}
      <View style={styles.startBtnContainer}>
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.primaryPurple }]}
          activeOpacity={0.8}
          onPress={onStartRoute}
          accessibilityLabel="Iniciar navegação da rota"
        >
          <Ionicons name="navigate" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.startBtnText}>Iniciar rota</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 54,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotContainer: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  purpleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
  },
  actionBtn: {
    padding: 4,
    marginLeft: 8,
  },
  connectorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  connectorLineContainer: {
    width: 22,
    alignItems: "center",
    marginRight: 8,
  },
  dashedDivider: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 0.5,
    borderColor: "#D1C4E9",
  },
  startBtnContainer: {
    alignItems: "flex-end",
    marginTop: 10,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
