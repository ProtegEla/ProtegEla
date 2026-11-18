import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";
import { theme, useAppTheme } from "../../theme";

export interface ProfileMenuItemProps extends TouchableOpacityProps {
  label: string;
  variant?: "default" | "danger";
  containerStyle?: ViewStyle;
}

/**
 * Item de menu reutilizável para a tela/painel de Perfil (RF17).
 * Design pill arredondado, alinhamento à esquerda e suporte a tema claro/escuro.
 */
export const ProfileMenuItem: React.FC<ProfileMenuItemProps> = ({
  label,
  variant = "default",
  containerStyle,
  style,
  ...rest
}) => {
  const { colors } = useAppTheme();
  const isDanger = variant === "danger";

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: isDanger
            ? colors.profileDangerBackground
            : colors.profileButtonBackground,
        },
        containerStyle,
        style,
      ]}
      activeOpacity={0.8}
      {...rest}
    >
      <Text
        style={[
          styles.text,
          {
            color: isDanger ? colors.profileDangerText : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 20,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    width: "100%",
  },
  text: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily,
    textAlign: "left",
  },
});
