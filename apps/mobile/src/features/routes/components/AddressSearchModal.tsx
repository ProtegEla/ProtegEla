import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../../theme";
import { addressService, AddressSuggestion } from "../../../services/api/addresses";
import { localStorage, StoredRecentSearch } from "../../../storage/localStorage";

export interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: AddressSuggestion) => void;
  initialQuery?: string;
}

export const AddressSearchModal: React.FC<AddressSearchModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
  initialQuery = "",
}) => {
  const { colors, isDark } = useAppTheme();
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<StoredRecentSearch[]>([]);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      loadRecents();
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  const loadRecents = async () => {
    const recents = await localStorage.getRecentSearches();
    setRecentSearches(recents);
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await addressService.getSuggestions(text.trim(), 5);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = async (item: AddressSuggestion) => {
    await localStorage.saveRecentSearch(item);
    onSelectAddress(item);
    onClose();
  };

  const parseLabel = (label: string) => {
    const parts = label.split(",").map((p) => p.trim());
    const title = parts[0] || label;
    const subtitle = parts.slice(1).join(", ");
    return { title, subtitle };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: isDark ? colors.screenBackground : colors.screenBackground },
        ]}
      >
        <View style={styles.container}>
          {/* Barra Superior de Busca */}
          <View style={styles.searchBarRow}>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? colors.inputBackground : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Buscar um endereço"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={handleQueryChange}
                autoFocus={true}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query.length > 0 && Platform.OS !== "ios" && (
                <TouchableOpacity onPress={() => handleQueryChange("")} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Botão Fechar X */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Fechar busca"
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Estado de Carregamento */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primaryPurple} />
            </View>
          )}

          {/* Resultados do Autocomplete (quando há busca ativa) */}
          {query.trim().length >= 3 && !loading && (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Nenhum endereço encontrado para "{query}"
                </Text>
              }
              renderItem={({ item }) => {
                const { title, subtitle } = parseLabel(item.label);
                return (
                  <TouchableOpacity
                    style={[
                      styles.card,
                      {
                        backgroundColor: isDark ? colors.surface : "#FFFFFF",
                        borderColor: isDark ? colors.border : "transparent",
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.iconCol}>
                      <Ionicons name="location-outline" size={22} color={colors.primaryPurple} />
                    </View>
                    <View style={styles.textCol}>
                      <Text
                        style={[styles.title, { color: colors.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text
                          style={[styles.subtitle, { color: colors.textMuted }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Seção Recentes (quando o campo está vazio ou < 3 caracteres) */}
          {query.trim().length < 3 && (
            <View style={styles.recentsSection}>
              <Text style={[styles.sectionTitle, { color: colors.primaryPurple }]}>Recentes</Text>

              {recentSearches.length === 0 ? (
                <Text style={[styles.emptyRecentsText, { color: colors.textMuted }]}>
                  Suas buscas recentes aparecerão aqui.
                </Text>
              ) : (
                <FlatList
                  data={recentSearches}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.card,
                        {
                          backgroundColor: isDark ? colors.surface : "#FFFFFF",
                          borderColor: isDark ? colors.border : "transparent",
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() =>
                        handleSelect({
                          id: item.id,
                          label: item.label,
                          latitude: item.latitude,
                          longitude: item.longitude,
                        })
                      }
                    >
                      <View style={styles.iconCol}>
                        <MaterialCommunityIcons
                          name="autorenew"
                          size={22}
                          color={colors.textMuted}
                        />
                      </View>
                      <View style={styles.textCol}>
                        <Text
                          style={[styles.title, { color: colors.text }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.title}
                        </Text>
                        {item.subtitle ? (
                          <Text
                            style={[styles.subtitle, { color: colors.textMuted }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 8,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  closeButton: {
    marginLeft: 12,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  recentsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
    marginLeft: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconCol: {
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
    width: 28,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 30,
    fontSize: 14,
  },
  emptyRecentsText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
    fontStyle: "italic",
  },
});
