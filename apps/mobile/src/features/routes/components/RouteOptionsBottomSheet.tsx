import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../theme";
import { RouteOption } from "../../../services/api/routes";

export interface RouteOptionsBottomSheetProps {
  routes: RouteOption[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  loading?: boolean;
  exceeds30Percent?: boolean;
}

export const RouteOptionsBottomSheet: React.FC<RouteOptionsBottomSheetProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  loading = false,
  exceeds30Percent = false,
}) => {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surface : colors.screenBackground,
          borderTopColor: isDark ? colors.border : "#E2D9F3",
        },
      ]}
    >
      {/* Título da Seção */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.primaryPurple }]}>Rotas</Text>
      </View>

      {/* Alerta de Desvio > 30% (RN04 / RN07) */}
      {exceeds30Percent && (
        <View style={styles.warningContainer}>
          <Ionicons name="information-circle" size={16} color="#E65100" style={{ marginRight: 6 }} />
          <Text style={styles.warningText}>
            A rota mais segura acrescenta mais de 30% no tempo estimado.
          </Text>
        </View>
      )}

      {/* Estado de Carregamento */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primaryPurple} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Calculando melhores alternativas de rota a pé...
          </Text>
        </View>
      ) : (
        /* Lista dos 3 Cards de Rota (Imagem 2) */
        <View style={styles.routesList}>
          {routes.map((route) => {
            const isSelected = route.id === selectedRouteId;

            return (
              <TouchableOpacity
                key={route.id}
                style={[
                  styles.routeCard,
                  {
                    backgroundColor: isDark ? colors.inputBackground : "#FFFFFF",
                    borderColor: isSelected ? colors.primaryPurple : "transparent",
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => onSelectRoute(route.id)}
              >
                {/* Linha 1: Tag da Rota e Badge de Risco */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.tagBadge, { backgroundColor: route.tagBgColor }]}>
                    <Text style={styles.tagBadgeText}>{route.label}</Text>
                  </View>

                  <Text style={[styles.riskBadgeText, { color: route.riskBadgeColor }]}>
                    {route.riskBadgeLabel}
                  </Text>
                </View>

                {/* Linha 2: Duração e Distância */}
                <View style={styles.cardDetailsRow}>
                  <View style={styles.metricGroup}>
                    <Text style={[styles.durationText, { color: colors.text }]}>
                      {route.durationLabel}
                    </Text>
                    <Ionicons
                      name="walk"
                      size={18}
                      color={colors.text}
                      style={styles.walkIcon}
                    />
                  </View>

                  <Text style={[styles.distanceText, { color: colors.textMuted }]}>
                    {route.distanceLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 25,
  },
  headerRow: {
    marginBottom: 12,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#E65100",
    fontWeight: "500",
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  routesList: {
    gap: 10,
  },
  routeCard: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tagBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tagBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  riskBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  durationText: {
    fontSize: 16,
    fontWeight: "700",
    marginRight: 4,
  },
  walkIcon: {
    marginLeft: 2,
  },
  distanceText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
