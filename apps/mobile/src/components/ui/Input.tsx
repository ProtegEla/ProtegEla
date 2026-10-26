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
import { theme } from "../../theme";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

/**
 * Componente de Input Reutilizável com suporte a estados de erro e acessibilidade.
 * Segue o padrão visual do Figma (Fundo #F8FAFC, cantos arredondados, tipografia Manrope).
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  placeholderTextColor = theme.colors.textMuted,
  ...rest
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={placeholderTextColor}
          {...rest}
        />
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
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
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 20,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputWrapperError: {
    borderColor: theme.colors.danger,
  },
  input: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
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
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.xs,
    marginTop: 4,
    marginLeft: theme.spacing.sm,
  },
});
