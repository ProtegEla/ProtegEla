import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet, View, Platform } from "react-native";
import { ThemeProvider, useAppTheme } from "../src/theme";
import { AuthProvider } from "../src/features/auth/AuthContext";

function InnerLayout() {
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.overflowX = "hidden";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      const rootEl = document.getElementById("root");
      if (rootEl) {
        rootEl.style.display = "flex";
        rootEl.style.flexDirection = "column";
        rootEl.style.height = "100%";
        rootEl.style.width = "100%";
        rootEl.style.overflow = "hidden";
      }

      // Remove outline/bordas amarelas e azuis de foco nativas do navegador
      const styleEl = document.createElement("style");
      styleEl.innerHTML = `
        input, textarea, select, [contenteditable] {
          outline: none !important;
          box-shadow: none !important;
        }
        *:focus {
          outline: none !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.screenBackground }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.screenBackground,
            flex: 1,
            width: "100%",
          },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={styles.safeAreaProvider}>
      <ThemeProvider>
        <AuthProvider>
          <InnerLayout />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeAreaProvider: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  rootContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
});
