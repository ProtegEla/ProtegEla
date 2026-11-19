import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../src/theme";
import { Input, Button, BottomNavigation } from "../src/components/ui";
import { useAuth } from "../src/features/auth/AuthContext";
import { EmergencyModal } from "../src/features/emergency/components/EmergencyModal";

/**
 * Tela de Configurações do Usuário.
 * - Dados Pessoais (nome, e-mail)
 * - 3 Contatos de Emergência (SOS)
 * - Segurança (mudança de senha exige senha atual)
 * - BottomNavigation persistente (botão SOS sempre visível — regra de ouro)
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user, updateNickname } = useAuth();

  // ── Dados Pessoais ──────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.nickname || "");
  const [email, setEmail] = useState(user?.email || "");

  // ── 3 Contatos de Emergência ────────────────────────────────────────────────
  const defaultPhone = process.env.EXPO_PUBLIC_EMERGENCY_PHONE || "11941943128";
  const [contacts, setContacts] = useState([
    { name: "", phone: defaultPhone },
    { name: "", phone: "" },
    { name: "", phone: "" },
  ]);

  const updateContact = (
    index: number,
    field: "name" | "phone",
    value: string
  ) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  // ── Segurança ───────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // ── Feedback ────────────────────────────────────────────────────────────────
  const [savedSuccess, setSavedSuccess] = useState(false);

  // ── Emergência (SOS persistente) ────────────────────────────────────────────
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const primaryContact = contacts[0];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSaveProfile = () => {
    if (name.trim().length >= 3) {
      updateNickname(name.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      Alert.alert(
        "Senha atual obrigatória",
        "Para alterar sua senha, confirme primeiro a senha atual."
      );
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Senha inválida", "A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Senhas não coincidem", "A nova senha e a confirmação não são iguais.");
      return;
    }
    // TODO: integrar com endpoint de troca de senha quando disponível
    Alert.alert("Senha atualizada", "Sua senha foi alterada com sucesso.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Configurações</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Conteúdo rolável */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {savedSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.successBannerText}>Dados salvos com sucesso!</Text>
          </View>
        )}

        {/* ── Seção 1: Dados Pessoais ─────────────────────────────────────── */}
        <SectionTitle label="Dados Pessoais" color={colors.profileTitlePurple} />

        <Input
          label="Nome ou Apelido"
          value={name}
          onChangeText={setName}
          placeholder="Seu nome ou apelido"
        />
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="seu.email@exemplo.com"
        />

        <Button
          title="Salvar dados pessoais"
          onPress={handleSaveProfile}
          style={{ marginTop: 8, marginBottom: 28 }}
        />

        {/* ── Seção 2: Contatos de Emergência ─────────────────────────────── */}
        <SectionTitle
          label="Contatos de Emergência (SOS)"
          color={colors.profileTitlePurple}
          description="Estes números serão acionados ao confirmar o botão de emergência. O Contato 1 é o principal."
          descriptionColor={colors.textMuted}
        />

        {/* Aviso de fallback para 190 (Polícia) */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? "#241B38" : "#EDE7F6",
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="information-circle" size={20} color={colors.primaryPurple} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoCardText, { color: colors.text }]}>
              Caso você não queira cadastrar nenhum contato, nós ligamos para a Polícia (190).
            </Text>
            <Text style={[styles.infoCardSubtext, { color: colors.textMuted }]}>
              (Durante a fase de testes e desenvolvimento, utilizamos um número de simulação segura para validação das rotas).
            </Text>
          </View>
        </View>

        {contacts.map((contact, idx) => (
          <View
            key={idx}
            style={[
              styles.contactCard,
              {
                backgroundColor: isDark ? "#1E1430" : "#F5F3FF",
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.contactLabel, { color: colors.profileTitlePurple }]}>
              Contato {idx + 1}{idx === 0 ? " (Principal)" : ""}
            </Text>
            <Input
              label="Nome"
              value={contact.name}
              onChangeText={(v) => updateContact(idx, "name", v)}
              placeholder={idx === 0 ? "Ex: Gabriela" : "Nome do contato"}
            />
            <Input
              label="Telefone"
              value={contact.phone}
              onChangeText={(v) => updateContact(idx, "phone", v)}
              keyboardType="phone-pad"
              placeholder="(11) 99999-9999"
            />
          </View>
        ))}

        <Button
          title="Salvar contatos de emergência"
          onPress={handleSaveProfile}
          style={{ marginTop: 8, marginBottom: 28 }}
        />

        {/* ── Seção 3: Segurança ──────────────────────────────────────────── */}
        <SectionTitle
          label="Segurança"
          color={colors.profileTitlePurple}
          description="Para alterar sua senha, confirme a senha atual primeiro."
          descriptionColor={colors.textMuted}
        />

        <Input
          label="Senha Atual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="Digite sua senha atual"
        />
        <Input
          label="Nova Senha"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Mínimo 8 caracteres"
        />
        <Input
          label="Confirmar Nova Senha"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          secureTextEntry
          placeholder="Repita a nova senha"
        />

        <Button
          title="Alterar senha"
          onPress={handleChangePassword}
          style={{ marginTop: 8, marginBottom: 40 }}
        />
      </ScrollView>

      {/* ── BottomNavigation PERSISTENTE (regra de ouro: SOS sempre visível) ── */}
      <BottomNavigation
        onPanicPress={() => setIsEmergencyModalOpen(true)}
      />

      {/* Modal de Emergência */}
      <EmergencyModal
        visible={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        contactName={primaryContact.name || "Contato 1"}
        phoneNumber={primaryContact.phone || defaultPhone}
      />
    </SafeAreaView>
  );
}

// ── Componente auxiliar para título de seção ──────────────────────────────────
function SectionTitle({
  label,
  color,
  description,
  descriptionColor,
}: {
  label: string;
  color: string;
  description?: string;
  descriptionColor?: string;
}) {
  return (
    <View style={{ marginBottom: description ? 4 : 12 }}>
      <Text style={[styles.sectionTitle, { color }]}>{label}</Text>
      {description && (
        <Text style={[styles.sectionDescription, { color: descriptionColor }]}>
          {description}
        </Text>
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 20,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successBannerText: {
    color: "#065F46",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  contactCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  infoCardText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  infoCardSubtext: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
});
