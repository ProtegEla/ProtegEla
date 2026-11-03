import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme, useAppTheme } from "../src/theme";
import { BottomNavigation, ProfileMenuItem } from "../src/components/ui";
import { useAuth } from "../src/features/auth/AuthContext";

/**
 * Tela Principal / Home do ProtegEla (RF03, RF05, RF10, RF12, RF14).
 * Ponto de entrada padrão do aplicativo (acesso sem login - RF03).
 * 100% Responsiva para celular e web.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { isLoggedIn, user, logout, updateNickname, login } = useAuth();

  const nickname = user?.nickname || "Maria";
  const email = user?.email || "maria.lopez@gmail.com";

  // Edição inline de apelido no painel lateral
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);

  // Controle da gaveta/painel lateral
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSaveInlineNickname = () => {
    if (tempNickname.trim().length >= 3) {
      updateNickname(tempNickname.trim());
    }
    setIsEditingNickname(false);
  };

  const handleLogout = () => {
    logout();
    setIsDrawerOpen(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.screenBackground }]}>
      <View style={styles.mainContainer}>
        {/* ================= ÁREA DO MAPA (LIMPA / SEM ELEMENTOS ESTOURANDO) ================= */}
        <View
          style={[
            styles.mapArea,
            {
              backgroundColor: isDark ? "#171022" : "#F8FAFC",
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.mapCenterNotice}>
            <MaterialCommunityIcons
              name="map-outline"
              size={48}
              color={colors.textMuted}
              style={{ opacity: 0.5, marginBottom: 8 }}
            />
            <Text style={[styles.mapNoticeTitle, { color: colors.text }]}>
              Área do Mapa Interativo
            </Text>
            <Text style={[styles.mapNoticeSubtitle, { color: colors.textMuted }]}>
              Carregando camadas e dados de rotas seguras via API.
            </Text>
          </View>
        </View>

        {/* ================= BARRA SUPERIOR (BUSCA + AÇÃO CONFORME ESTADO) ================= */}
        <View style={styles.topBar}>
          <View
            style={[
              styles.searchPill,
              {
                backgroundColor: isDark ? "#241B38" : "#EDE9F5",
              },
            ]}
          >
            <Ionicons
              name="search"
              size={18}
              color={colors.primaryPurple}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Buscar um endereço"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          {isLoggedIn ? (
            /* Botão de 3 barrinhas (quando logada) */
            <TouchableOpacity
              style={[
                styles.iconButton,
                { backgroundColor: isDark ? "#241B38" : "#EDE9F5" },
              ]}
              onPress={() => setIsDrawerOpen(true)}
              activeOpacity={0.7}
              accessibilityLabel="Abrir menu de perfil"
            >
              <Ionicons name="menu" size={24} color={colors.primaryPurple} />
            </TouchableOpacity>
          ) : (
            /* Botão direto "Entrar" (quando deslogada - RF03) */
            <TouchableOpacity
              style={[
                styles.loginButtonTop,
                { backgroundColor: colors.primaryPurple },
              ]}
              onPress={() => router.push("/login")}
              activeOpacity={0.8}
              accessibilityLabel="Fazer login"
            >
              <Text style={styles.loginButtonText}>Entrar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ================= BOTÕES FLUTUANTES (FABS À DIREITA) ================= */}
        <View style={styles.fabsContainer}>
          {/* Botão Recentralizar (Alvo / Mira GPS) */}
          <TouchableOpacity
            style={[
              styles.fabSmall,
              { backgroundColor: isDark ? "#241B38" : "#EDE9F5" },
            ]}
            activeOpacity={0.8}
            accessibilityLabel="Recentralizar mapa"
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={24}
              color={colors.primaryPurple}
            />
          </TouchableOpacity>

          {/* Botão Adicionar Relato (Roxo + Triângulo) */}
          <TouchableOpacity
            style={[styles.fabPrimary, { backgroundColor: colors.primaryPurple }]}
            activeOpacity={0.85}
            onPress={() => {
              if (!isLoggedIn) {
                router.push("/login");
              }
            }}
            accessibilityLabel="Adicionar relato de risco"
          >
            <Ionicons name="warning" size={22} color="#FFFFFF" />
            <Text style={styles.fabPlusSign}>+</Text>
          </TouchableOpacity>
        </View>

        {/* ================= PAINEL LATERAL / DRAWER DO PERFIL ================= */}
        <Modal
          visible={isDrawerOpen}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setIsEditingNickname(false);
            setIsDrawerOpen(false);
          }}
        >
          <View style={styles.drawerOverlay}>
            {/* Backdrop clicável fora da sidebar (área do mapa) */}
            <TouchableOpacity
              style={styles.backdropPressable}
              activeOpacity={1}
              onPress={() => {
                setIsEditingNickname(false);
                setIsDrawerOpen(false);
              }}
              accessibilityLabel="Fechar menu ao tocar fora"
            />

            <View
              style={[
                styles.drawerContainer,
                { backgroundColor: colors.screenBackground },
              ]}
            >
              {/* Botão de Fechar no topo direito */}
              <View style={styles.drawerHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditingNickname(false);
                    setIsDrawerOpen(false);
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Fechar menu"
                >
                  <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.drawerScroll}
              >
                {/* Seção da Usuária com Edição Inline */}
                <View style={styles.userSection}>
                  <View style={styles.nameRow}>
                    {isEditingNickname ? (
                      <View style={styles.inlineEditWrapper}>
                        <TextInput
                          value={tempNickname}
                          onChangeText={setTempNickname}
                          autoFocus
                          style={[
                            styles.inlineInput,
                            {
                              color: colors.profileTitlePurple,
                              borderColor: colors.primaryPurple,
                              backgroundColor: colors.inputBackground,
                            },
                          ]}
                          onSubmitEditing={handleSaveInlineNickname}
                        />
                        <TouchableOpacity
                          style={[
                            styles.inlineSaveBtn,
                            { backgroundColor: colors.primaryPurple },
                          ]}
                          onPress={handleSaveInlineNickname}
                          accessibilityLabel="Salvar apelido"
                        >
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.inlineDisplayWrapper}>
                        <Text
                          style={[
                            styles.nicknameText,
                            { color: colors.profileTitlePurple },
                          ]}
                        >
                          {nickname}
                        </Text>
                        <TouchableOpacity
                          style={styles.editIconBadge}
                          onPress={() => {
                            setTempNickname(nickname);
                            setIsEditingNickname(true);
                          }}
                          accessibilityLabel="Editar apelido diretamente"
                        >
                          <Ionicons name="pencil" size={13} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.emailText,
                      { color: colors.profileSubtitlePurple },
                    ]}
                  >
                    {email}
                  </Text>
                </View>

                {/* Itens do Menu */}
                <View style={styles.menuItemsList}>
                  <ProfileMenuItem label="Configurações" />
                  <ProfileMenuItem
                    label={isDark ? "Modo claro" : "Modo escuro"}
                    onPress={toggleTheme}
                  />
                  <ProfileMenuItem label="Histórico" />
                  <ProfileMenuItem
                    label="Sair"
                    variant="danger"
                    onPress={handleLogout}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>

      {/* ================= BARRA INFERIOR PERSISTENTE (SOS SEMPRE ACESSÍVEL) ================= */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mainContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },

  // Área do Mapa limpa e adaptável
  mapArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  mapCenterNotice: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  mapNoticeTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: "center",
  },
  mapNoticeSubtitle: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
    maxWidth: 280,
  },

  // Barra Superior
  topBar: {
    position: "absolute",
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    zIndex: 10,
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    paddingVertical: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: "none",
        outlineWidth: 0,
        outlineColor: "transparent",
        boxShadow: "none",
      } as any,
    }),
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  loginButtonTop: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },

  // FABs à Direita
  fabsContainer: {
    position: "absolute",
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    alignItems: "center",
    gap: theme.spacing.sm,
    zIndex: 10,
  },
  fabSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  fabPrimary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabPlusSign: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 2,
  },

  // Gaveta Lateral (Perfil)
  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  backdropPressable: {
    flex: 1,
    height: "100%",
  },
  drawerContainer: {
    width: "82%",
    maxWidth: 340,
    height: "100%",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  drawerHeader: {
    alignItems: "flex-end",
    marginBottom: theme.spacing.md,
  },
  drawerScroll: {
    flexGrow: 1,
  },
  userSection: {
    marginBottom: theme.spacing.xl,
  },
  nameRow: {
    marginBottom: 4,
  },
  inlineDisplayWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  nicknameText: {
    fontSize: 26,
    fontWeight: "800",
    fontFamily: theme.typography.fontFamily,
    marginRight: 8,
  },
  editIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  inlineEditWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineInput: {
    fontSize: 22,
    fontWeight: "800",
    borderBottomWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 140,
    fontFamily: theme.typography.fontFamily,
    ...Platform.select({
      web: {
        outlineStyle: "none",
        outlineWidth: 0,
        outlineColor: "transparent",
        boxShadow: "none",
      } as any,
    }),
  },
  inlineSaveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  emailText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
  },
  menuItemsList: {
    width: "100%",
  },
});
