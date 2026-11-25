import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../src/features/auth/AuthContext";
import { useEmergencyTarget } from "../src/features/shared/useScreenData";

export default function CallingScreen() {
  const { isLoggedIn, user } = useAuth();
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const sessionKey = isLoggedIn
    ? `user:${user?.email ?? "authenticated"}`
    : "guest";

  const {
    target,
    loading,
    error,
    refresh,
  } = useEmergencyTarget(sessionKey, {
    enabled: focused,
    isLoggedIn,
  });

  const [opening, setOpening] = useState(false);
  const [callError, setCallError] = useState("");

  const openingRef = useRef(false);
  const activeRef = useRef(false);
  const shakeX = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const shake = Animated.loop(
          Animated.sequence([
          Animated.timing(shakeX, {
              toValue: -4,
              duration: 50,
              easing: Easing.linear,
              useNativeDriver: true,
          }),
          Animated.timing(shakeX, {
              toValue: 4,
              duration: 100,
              easing: Easing.linear,
              useNativeDriver: true,
          }),
          Animated.timing(shakeX, {
              toValue: 0,
              duration: 50,
              easing: Easing.linear,
              useNativeDriver: true,
          }),
          Animated.delay(1000),
          ]),
      );

      shake.start();

      Vibration.vibrate(
          Platform.OS === 'android'
          ? [0, 200, 1000]
          : [0, 1200],
          true,
      );

      return () => {
          shake.stop();
          shakeX.setValue(0);
          Vibration.cancel();
      };
    }, [shakeX]);

  async function confirm() {
    if (!focused || loading || !target || openingRef.current) {
      return;
    }

    const phone = target.phone.replace(/[\s().-]/g, "");

    if (!/^\+?\d{3,15}$/.test(phone)) {
      setCallError("O telefone retornado pelo servidor é inválido.");
      return;
    }

    openingRef.current = true;
    setOpening(true);
    setCallError("");

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      if (activeRef.current) {
        setCallError(
          "Não foi possível abrir o discador neste dispositivo.",
        );
      }
    } finally {
      openingRef.current = false;

      if (activeRef.current) {
        setOpening(false);
      }
    }
  }

  function cancel() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  const disabled =
    !focused || loading || !target || opening;

  return (
    <SafeAreaView style={s.screen}>
      <Animated.View
        style={[
          s.content,
          { transform: [{ translateX: shakeX }] },
        ]}
      >
        <View style={s.icon}>
          <Ionicons
            name="notifications-outline"
            size={38}
            color="#DC2626"
          />
        </View>

        <Text style={s.overline}>Ligar para</Text>

        {loading ? (
          <ActivityIndicator
            color="#DC2626"
            style={s.loader}
          />
        ) : target ? (
          <>
            <Text style={s.name}>{target.label}</Text>
            <Text style={s.phone}>{target.phone}</Text>
          </>
        ) : null}

        {!!error && (
          <View style={s.feedback} accessibilityRole="alert">
            <Text style={s.feedbackText}>{error}</Text>

            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              style={s.retry}
            >
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}

        {!!callError && (
          <Text
            accessibilityRole="alert"
            style={s.feedbackText}
          >
            {callError}
          </Text>
        )}

        <Pressable
          onPress={confirm}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={[s.confirm, disabled && s.disabled]}
        >
          <Text style={s.confirmText}>
            {opening ? "Abrindo discador…" : "Confirmar"}
          </Text>
        </Pressable>

        <Pressable
          onPress={cancel}
          accessibilityRole="button"
          style={s.cancel}
        >
          <Text style={s.cancelText}>Cancelar</Text>
        </Pressable>

        <Text style={s.caption}>
          Ao confirmar, o discador será aberto para realizar
          a ligação.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5E7EA",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 440,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: "center",
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FBE3E6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  overline: {
    color: "#DC2626",
    fontSize: 19,
    fontWeight: "500",
  },
  name: {
    color: "#DC2626",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  phone: {
    color: "#9F2538",
    fontSize: 18,
    marginTop: 8,
  },
  loader: { marginVertical: 20 },
  confirm: {
    width: "100%",
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 42,
  },
  disabled: { opacity: 0.5 },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  cancel: {
    width: "100%",
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  cancelText: {
    color: "#DC2626",
    fontSize: 17,
    fontWeight: "600",
  },
  caption: {
    color: "#80545E",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 20,
  },
  feedback: { alignItems: "center", marginTop: 18 },
  feedbackText: {
    color: "#9F1239",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 12,
  },
  retry: { padding: 14 },
  retryText: { color: "#9F1239", fontWeight: "700" },
});