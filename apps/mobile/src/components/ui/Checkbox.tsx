import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  TouchableOpacityProps,
} from "react-native";
import { theme } from "../../theme";

export interface CheckboxProps extends TouchableOpacityProps {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

/**
 * Componente Checkbox Reutilizável.
 * Estilizado com borda/fundo roxo (#8055B5) e rótulo personalizável ("Lembrar de mim").
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onToggle,
  style,
  ...rest
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={0.7}
      onPress={() => onToggle(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      {...rest}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: theme.spacing.xs,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.primaryPurple,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
    backgroundColor: "transparent",
  },
  boxChecked: {
    backgroundColor: theme.colors.primaryPurple,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: -2,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
  },
});
