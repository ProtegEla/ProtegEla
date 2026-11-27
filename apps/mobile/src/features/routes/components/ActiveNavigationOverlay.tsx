import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../theme";
import type { RouteOption } from "../../../services/api/routes";
import {
  formatDistanceMeters,
  formatDurationSeconds,
  getManeuverIconName,
  type NavigationProgress,
} from "../utils/navigationMath";

export interface ActiveNavigationOverlayProps {
  route: RouteOption;
  destinationLabel: string;
  progress: NavigationProgress | null;
  backgroundNotice?: string | null;
  onStopNavigation: () => void;
}

export const ActiveNavigationOverlay: React.FC<ActiveNavigationOverlayProps> = ({
  route,
  destinationLabel,
  progress,
  backgroundNotice,
  onStopNavigation,
}) => {
  const { colors, isDark } = useAppTheme();
  const [showAllSteps, setShowAllSteps] = useState(false);

  const currentStep = progress?.currentStep ?? route.steps[0] ?? null;
  const currentIdx = progress?.currentStepIndex ?? 0;
  const arrived = progress?.arrived ?? false;

  const instructionText = arrived
    ? "Você chegou ao seu destino!"
    : currentStep?.instruction || `Siga rumo a ${destinationLabel}`;

  const stepDistanceLabel = arrived
    ? "Chegada"
    : formatDistanceMeters(
        progress?.distanceToStepEndM ?? currentStep?.distanceM ?? route.distanceMeters
      );

  const remainingDistanceLabel = arrived
    ? "0 m"
    : formatDistanceMeters(progress?.remainingDistanceM ?? route.distanceMeters);

  const remainingDurationLabel = arrived
    ? "0 min"
    : formatDurationSeconds(progress?.remainingDurationS ?? route.durationSeconds);

  const iconName = arrived ? "flag" : getManeuverIconName(instructionText);

  return (
    <>
      {/* ================= CARD SUPERIOR DE INSTRUÇÃO (TURN-BY-TURN) ================= */}
      <View style={styles.topContainer} pointerEvents="box-none">
        <View
          style={[
            styles.instructionCard,
            {
              backgroundColor: arrived ? "#00695C" : colors.primaryPurple,
            },
          ]}
        >
          <View style={styles.instructionRow}>
            <View style={styles.maneuverIconBox}>
              <Ionicons name={iconName} size={26} color="#FFFFFF" />
            </View>

            <View style={styles.instructionTextCol}>
              <Text style={styles.stepDistanceText}>{stepDistanceLabel}</Text>
              <Text style={styles.instructionTitle} numberOfLines={2}>
                {instructionText}
              </Text>
            </View>

            {route.steps.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowAllSteps((prev) => !prev)}
                style={styles.stepsToggleBtn}
                accessibilityLabel={
                  showAllSteps ? "Ocultar passos da rota" : "Ver todos os passos da rota"
                }
              >
                <Ionicons
                  name={showAllSteps ? "chevron-up" : "list"}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
          </View>

          {!arrived && progress?.nextStep && (
            <View style={styles.nextStepBanner}>
              <Text style={styles.nextStepText} numberOfLines={1}>
                Depois: {progress.nextStep.instruction}
              </Text>
            </View>
          )}
        </View>

        {backgroundNotice ? (
          <View
            style={[
              styles.noticePill,
              { backgroundColor: isDark ? colors.surface : "#FFF8E1" },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={15}
              color="#B45309"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.noticeText} numberOfLines={2}>
              {backgroundNotice}
            </Text>
          </View>
        ) : null}

        {/* Lista Expansível de Todos os Passos */}
        {showAllSteps && route.steps.length > 0 && (
          <View
            style={[
              styles.stepsListCard,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2D9F3",
              },
            ]}
          >
            <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator>
              {route.steps.map((step, index) => {
                const isCurrent = index === currentIdx && !arrived;
                const isDone = index < currentIdx || arrived;
                return (
                  <View
                    key={`${index}-${step.instruction}`}
                    style={[
                      styles.stepItem,
                      {
                        borderBottomColor: isDark ? colors.border : "#F1ECF9",
                        opacity: isDone ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={getManeuverIconName(step.instruction)}
                      size={18}
                      color={isCurrent ? colors.primaryPurple : colors.textMuted}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.stepItemText,
                          {
                            color: colors.text,
                            fontWeight: isCurrent ? "700" : "400",
                          },
                        ]}
                      >
                        {step.instruction}
                      </Text>
                      <Text style={[styles.stepItemMeta, { color: colors.textMuted }]}>
                        {formatDistanceMeters(step.distanceM)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ================= BARRA INFERIOR DE PROGRESSO E ENCERRAMENTO ================= */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: isDark ? colors.surface : "#FFFFFF",
            borderTopColor: isDark ? colors.border : "#E2D9F3",
          },
        ]}
      >
        <View style={styles.bottomMetricsCol}>
          <View style={styles.bottomMetricsRow}>
            <Text style={[styles.remainingTimeText, { color: colors.text }]}>
              {remainingDurationLabel}
            </Text>
            <Text style={[styles.remainingDot, { color: colors.textMuted }]}>•</Text>
            <Text style={[styles.remainingDistText, { color: colors.textMuted }]}>
              {remainingDistanceLabel}
            </Text>
            <Text
              style={[
                styles.riskMiniBadge,
                { color: route.riskBadgeColor },
              ]}
            >
              {route.riskBadgeLabel}
            </Text>
          </View>
          <Text
            style={[styles.destNameText, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            Destino: {destinationLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.stopBtn,
            { backgroundColor: arrived ? "#00695C" : "#D32F2F" },
          ]}
          activeOpacity={0.85}
          onPress={onStopNavigation}
          accessibilityLabel={arrived ? "Concluir rota" : "Encerrar navegação"}
        >
          <Text style={styles.stopBtnText}>
            {arrived ? "Concluir" : "Encerrar"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 54,
    left: 16,
    right: 16,
    zIndex: 35,
  },
  instructionCard: {
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  maneuverIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  instructionTextCol: {
    flex: 1,
  },
  stepDistanceText: {
    color: "#EDE9F5",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  instructionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  stepsToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  nextStepBanner: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  nextStepText: {
    color: "#F3EEF9",
    fontSize: 13,
    fontWeight: "500",
  },
  noticePill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
  },
  stepsListCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 210,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  stepsScroll: {
    paddingHorizontal: 12,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stepItemText: {
    fontSize: 14,
  },
  stepItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 30,
  },
  bottomMetricsCol: {
    flex: 1,
    marginRight: 12,
  },
  bottomMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  remainingTimeText: {
    fontSize: 18,
    fontWeight: "800",
  },
  remainingDot: {
    marginHorizontal: 6,
    fontSize: 16,
  },
  remainingDistText: {
    fontSize: 15,
    fontWeight: "600",
    marginRight: 10,
  },
  riskMiniBadge: {
    fontSize: 12,
    fontWeight: "700",
  },
  destNameText: {
    fontSize: 13,
  },
  stopBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  stopBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
