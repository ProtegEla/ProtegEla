import React from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Platform,
} from "react-native";
import { theme, useAppTheme } from "../../theme";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

/**
 * Componente de Input Reutilizável com suporte a estados de erro e modo escuro.
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  placeholderTextColor,
  ...rest
}) => {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={placeholderTextColor || colors.textMuted}
          {...rest}
        />
      </View>
      {!!error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    borderRadius: 20,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
  },
  input: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: "transparent",
    ...Platform.select({
      web: {
        outlineStyle: "none",
        outlineColor: "transparent",
        boxShadow: "none",
      } as any,
    }),
  },
  errorText: {
    fontSize: theme.typography.sizes.xs,
    marginTop: 4,
    marginLeft: theme.spacing.sm,
  },
});
