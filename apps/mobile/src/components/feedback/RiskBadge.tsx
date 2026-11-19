import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../theme";
import { RiskLevel } from "../../types/route";

export interface RiskBadgeProps {
  level: RiskLevel;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const getBadgeConfig = () => {
    switch (level) {
      case "EXTREMO":
        return {
          backgroundColor: theme.colors.riskExtreme,
          label: "Risco Extremo",
        };
      case "ALTO":
        return {
          backgroundColor: theme.colors.riskHigh,
          label: "Risco Alto",
        };
      case "MODERADO":
      default:
        return {
          backgroundColor: theme.colors.riskModerate,
          label: "Risco Moderado",
        };
    }
  };

  const { backgroundColor, label } = getBadgeConfig();

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.spacing.xs,
    alignSelf: "flex-start",
  },
  text: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    textTransform: "uppercase",
  },
});
