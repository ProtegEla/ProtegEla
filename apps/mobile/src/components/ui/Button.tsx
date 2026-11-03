import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from "react-native";
import { theme, useAppTheme } from "../../theme";

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "outline";
  isLoading?: boolean;
}

/**
 * Componente de Botão Acessível (RNF08) com suporte a tema.
 */
export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  isLoading = false,
  disabled,
  style,
  ...rest
}) => {
  const { colors } = useAppTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case "danger":
        return colors.danger;
      case "secondary":
        return colors.primaryPurple;
      case "outline":
        return "transparent";
      default:
        return colors.primaryAction;
    }
  };

  const getTextColor = () => {
    if (variant === "outline") return colors.primaryAction;
    return "#FFFFFF";
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: variant === "outline" ? colors.primaryAction : "transparent",
        },
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primaryAction : "#FFFFFF"} />
      ) : (
        <Text style={[styles.textBase, { color: getTextColor() }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
});
