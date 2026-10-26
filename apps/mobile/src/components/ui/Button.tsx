import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from "react-native";
import { theme } from "../../theme";

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "outline";
  isLoading?: boolean;
}

/**
 * Componente de Botão Acessível (RNF08).
 * Garante altura mínima para toque seguro (48px) e contraste de cores adequado.
 */
export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  isLoading = false,
  disabled,
  style,
  ...rest
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case "danger":
        return styles.danger;
      case "secondary":
        return styles.secondary;
      case "outline":
        return styles.outline;
      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    if (variant === "outline") return styles.textOutline;
    return styles.textSolid;
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        getVariantStyle(),
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === "outline" ? theme.colors.primary : "#FFFFFF"} />
      ) : (
        <Text style={[styles.textBase, getTextStyle()]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48, // Alvo de toque acessível (RNF08)
    borderRadius: 24, // Borda arredondada suave do Figma
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  primary: {
    backgroundColor: theme.colors.primaryAction,
  },
  secondary: {
    backgroundColor: theme.colors.primaryPurple,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.colors.primaryAction,
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  textSolid: {
    color: "#FFFFFF",
  },
  textOutline: {
    color: theme.colors.primaryAction,
  },
});
