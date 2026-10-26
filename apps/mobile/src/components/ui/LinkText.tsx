import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  TextStyle,
} from "react-native";
import { theme } from "../../theme";

export interface LinkTextProps extends TouchableOpacityProps {
  text: string;
  actionText?: string;
  underline?: boolean;
  align?: "left" | "center" | "right";
  textStyle?: TextStyle;
  actionStyle?: TextStyle;
}

/**
 * Componente Reutilizável para links de texto e navegação contextual.
 * Suporta textos simples ("Esqueceu a senha?", "Acessar sem login") ou compostos ("Não tem conta? Cadastre-se").
 */
export const LinkText: React.FC<LinkTextProps> = ({
  text,
  actionText,
  underline = true,
  align = "center",
  textStyle,
  actionStyle,
  style,
  ...rest
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.container,
        align === "left" && styles.alignLeft,
        align === "right" && styles.alignRight,
        style,
      ]}
      accessibilityRole="button"
      {...rest}
    >
      <Text style={[styles.text, textStyle]}>
        {text}
        {actionText ? " " : ""}
        {actionText && (
          <Text
            style={[
              styles.actionText,
              underline && styles.underline,
              actionStyle,
            ]}
          >
            {actionText}
          </Text>
        )}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  text: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
  },
  actionText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
  },
  underline: {
    textDecorationLine: "underline",
  },
});
