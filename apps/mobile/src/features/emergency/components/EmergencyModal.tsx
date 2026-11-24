import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface EmergencyModalProps {
  visible: boolean;
  onClose: () => void;
  contactName?: string;
  phoneNumber?: string;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  visible,
  onClose,
  contactName = "Gabriela",
  phoneNumber,
}) => {
  // Número configurado ou fallback seguro
  const targetPhone =
    phoneNumber ||
    process.env.EXPO_PUBLIC_EMERGENCY_PHONE ||
    "1052"; // 1052: canal de teste de operadora para não incomodar emergência real

  const handleConfirmCall = () => {
    const url = `tel:${targetPhone}`;

    if (Platform.OS === "web") {
      // No navegador, aciona protocolo tel: (abre app de chamadas do Windows/Mac/Skype)
      try {
        window.location.href = url;
      } catch {
        Linking.openURL(url);
      }
    } else {
      // No celular Android / iOS nativo, abre o discador com o número preenchido
      Linking.openURL(url);
    }

    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Tag Topo */}
          <Text style={styles.topTag}>Emergência</Text>

          {/* Ícone de Sirene Piscante/Vermelha */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="alarm-light-outline" size={56} color="#DC2626" />
          </View>

          {/* Textos de Ligação */}
          <Text style={styles.callSubtitle}>Ligando para</Text>
          <Text style={styles.contactTitle}>“{contactName}”</Text>
          <Text style={styles.phoneHint}>({targetPhone})</Text>

          {/* Botão Confirmar (Vermelho Forte) */}
          <TouchableOpacity
            style={styles.confirmBtn}
            activeOpacity={0.85}
            onPress={handleConfirmCall}
          >
            <Text style={styles.confirmBtnText}>Confirmar</Text>
          </TouchableOpacity>

          {/* Botão Cancelar (Branco) */}
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FDF2F2", // Tom rosado/vermelho claro do Figma
    borderRadius: 32,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  topTag: {
    position: "absolute",
    top: 18,
    left: 24,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  callSubtitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 4,
  },
  contactTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#DC2626",
    textAlign: "center",
  },
  phoneHint: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 28,
  },
  confirmBtn: {
    width: "100%",
    backgroundColor: "#DC2626", // Vermelho do botão Figma
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    elevation: 4,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelBtn: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cancelBtnText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "600",
  },
});
