import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../theme";

import type { CreateReportPayload } from "../reportModel";

export interface CreateReportBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateReportPayload,
  ) => void | Promise<void>;
  currentAddress?: string;
}

export const CreateReportBottomSheet: React.FC<CreateReportBottomSheetProps> = ({
  visible,
  onClose,
  onSubmit,
  currentAddress = "Endereço atual do mapa",
}) => {
  const { colors, isDark } = useAppTheme();

  const [addressDetail, setAddressDetail] = useState("");
  const [incidentType, setIncidentType] = useState("Assédio");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("noite");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      {/* Backdrop clicável para fechar tocando fora */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: isDark ? "#2A1F45" : "#6D4DA8", // Roxo do Figma
          },
        ]}
      >
        {/* Header com Título e Fechar */}
        <View style={styles.header}>
          <Text style={styles.title}>Adicionar relato</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Endereço Selecionado */}
          <Text style={styles.label}>Endereço</Text>
          <View style={styles.fieldBox}>
            <Ionicons name="location-outline" size={18} color="#4A3475" style={{ marginRight: 6 }} />
            <Text style={styles.addressText} numberOfLines={1}>
              {currentAddress}
            </Text>
          </View>

          {/* Especificação do endereço */}
          <Text style={styles.label}>Especificação do endereço (opcional)</Text>
          <TextInput
            style={styles.inputBox}
            placeholder="Ex.: em frente ao supermercado X"
            placeholderTextColor="#8C7CA8"
            value={addressDetail}
            onChangeText={setAddressDetail}
          />

          {/* Tipo de incidente */}
          <Text style={styles.label}>Tipo de incidente</Text>
          <View style={styles.pillsRow}>
            {["Assédio", "Furto", "Violência", "Má iluminação"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.pillButton,
                  incidentType === type && styles.pillButtonActive,
                ]}
                onPress={() => setIncidentType(type)}
              >
                <Text
                  style={[
                    styles.pillText,
                    incidentType === type && styles.pillTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Descrição */}
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.inputBox, styles.textArea]}
            placeholder="Escreva uma pequena descrição"
            placeholderTextColor="#8C7CA8"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />

          {/* Período */}
          <Text style={styles.label}>Período</Text>
          <View style={styles.pillsRow}>
            {[
              { label: "Manhã", value: "manha" },
              { label: "Tarde", value: "tarde" },
              { label: "Noite", value: "noite" },
              { label: "Madrugada", value: "madrugada" },
            ].map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.pillButton,
                  period === p.value && styles.pillButtonActive,
                ]}
                onPress={() => setPeriod(p.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    period === p.value && styles.pillTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manter anonimato? */}
          <Text style={styles.label}>Manter anonimato?</Text>
          <View style={styles.radioRow}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setIsAnonymous(true)}
            >
              <Ionicons
                name={isAnonymous ? "radio-button-on" : "radio-button-off"}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.radioLabel}>Sim</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setIsAnonymous(false)}
            >
              <Ionicons
                name={!isAnonymous ? "radio-button-on" : "radio-button-off"}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.radioLabel}>Não</Text>
            </TouchableOpacity>
          </View>
          
          {!!submitError && (
            <Text
              accessibilityRole="alert"
              style={{
                color: "#FFFFFF",
                backgroundColor: "rgba(120, 0, 30, 0.35)",
                padding: 12,
                borderRadius: 12,
                marginTop: 16,
              }}
            >
              {submitError}
            </Text>
          )}
          {/* Rodapé: Cancelar e Concluir */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isSubmitting}
              style={[
                styles.submitBtn,
                isSubmitting && { opacity: 0.6 },
              ]}
              onPress={async () => {
                if (isSubmitting) return;

                setSubmitError("");
                setIsSubmitting(true);

                try {
                  await onSubmit({
                    category: incidentType,
                    description,
                    addressDetail,
                    period,
                    isAnonymous,
                  });
                } catch (error) {
                  setSubmitError(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível publicar o relato.",
                  );

                  setIsSubmitting(false);
                  return;
                }

                setIsSubmitting(false);
                onClose();
              }}
            >
              <Text style={styles.submitText}>
                {isSubmitting ? "Publicando…" : "Concluir"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    width: "94%",
    maxWidth: 500,
    alignSelf: "center",
    maxHeight: "85%",
    borderRadius: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  sosQuickBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    elevation: 4,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  sosQuickText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2D9F3",
    marginTop: 12,
    marginBottom: 6,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE7F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  addressText: {
    fontSize: 14,
    color: "#4A3475",
    fontWeight: "500",
  },
  inputBox: {
    backgroundColor: "#EDE7F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#37235E",
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pillButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  pillButtonActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  pillText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#6D4DA8",
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginTop: 4,
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radioLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  submitText: {
    fontSize: 15,
    color: "#6D4DA8",
    fontWeight: "bold",
  },
});
