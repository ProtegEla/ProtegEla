import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

type Props = {
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function ApiFeedback({
  loading,
  error,
  onRetry,
}: Props) {
  if (!loading && !error) return null;

  return (
    <View style={{ padding: 16, gap: 10 }}>
      {loading ? (
        <ActivityIndicator color="#8055B5" />
      ) : (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: "#9F1239", lineHeight: 21 }}
          >
            {error}
          </Text>

          {onRetry && (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={{
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#8055B5",
                  fontWeight: "700",
                }}
              >
                Tentar novamente
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}