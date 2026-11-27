import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  Platform,
  Vibration,
  Linking,
} from 'react-native';
import { usersService } from '../src/services/api/users';

type Props = {
  name?: string;
  phone?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export default function CallingScreen({
  name,
  phone,
  onConfirm,
  onCancel,
}: Props) {
    const [resolvedContact, setResolvedContact] = useState<{
      name: string;
      phone: string;
    }>({
      name: name || 'Contato de emergência',
      phone: phone || process.env.EXPO_PUBLIC_EMERGENCY_PHONE || '190',
    });

    useEffect(() => {
      if (name && phone) {
        setResolvedContact({ name, phone });
        return;
      }
      let active = true;
      usersService.getPrimaryEmergencyContact().then((contact) => {
        if (!active) return;
        setResolvedContact({
          name: name || contact.name,
          phone: phone || contact.phone,
        });
      });
      return () => {
        active = false;
      };
    }, [name, phone]);

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

    // No Android, alterna espera e vibração.
    // No iOS, os números representam intervalos entre vibrações.
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

    function handleConfirm() {
        Vibration.cancel();
        if (onConfirm) {
            onConfirm();
            return;
        }

        const targetPhone = resolvedContact.phone;
        const url = `tel:${targetPhone}`;
        if (Platform.OS === 'web') {
            try {
                window.location.href = url;
            } catch {
                Linking.openURL(url);
            }
        } else {
            Linking.openURL(url);
        }
    }

    function handleCancel() {
        Vibration.cancel();
        if (onCancel) {
            onCancel();
        } else {
            router.back();
        }
    }

  return (
    <Animated.View
        style={[
            styles.screen,
            { transform: [{ translateX: shakeX }] },
        ]}
    >
      <View style={styles.content}>
        <View style={styles.message}>
          <View style={styles.icon} accessible={false}>
            <View style={[styles.ray, styles.rayLeft]} />
            <View style={[styles.ray, styles.rayCenter]} />
            <View style={[styles.ray, styles.rayRight]} />
            <View style={styles.dome} />
            <View style={styles.base} />
          </View>

          <Text style={styles.subtitle}>Ligando para</Text>
          <Text style={styles.name}>“{resolvedContact.name}”</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Confirmar ligação para ${resolvedContact.name}`}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.button,
              styles.confirm,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.confirmText}>Confirmar</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar ligação"
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.button,
              styles.cancel,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const RED = '#EA2026';
const BACKGROUND = '#F5E5E8';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 360,
  },
  message: {
    alignItems: 'center',
    marginBottom: 56,
  },
  icon: {
    width: 40,
    height: 38,
    marginBottom: 20,
  },
  ray: {
    position: 'absolute',
    width: 2,
    height: 5,
    borderRadius: 1,
    backgroundColor: RED,
  },
  rayLeft: {
    top: 5,
    left: 6,
    transform: [{ rotate: '-45deg' }],
  },
  rayCenter: {
    top: 0,
    left: 19,
  },
  rayRight: {
    top: 5,
    right: 6,
    transform: [{ rotate: '45deg' }],
  },
  dome: {
    position: 'absolute',
    top: 10,
    left: 9,
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: RED,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  base: {
    position: 'absolute',
    top: 28,
    left: 4,
    width: 32,
    height: 10,
    borderWidth: 2,
    borderColor: RED,
    borderRadius: 2,
    backgroundColor: BACKGROUND,
  },
  subtitle: {
    color: RED,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  name: {
    marginTop: 4,
    color: RED,
    fontSize: 30,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    gap: 24,
  },
  button: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    backgroundColor: RED,
  },
  cancel: {
    backgroundColor: '#F7FAFB',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelText: {
    color: RED,
    fontSize: 18,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});