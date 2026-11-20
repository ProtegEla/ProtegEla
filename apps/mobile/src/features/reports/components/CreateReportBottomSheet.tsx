import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../../theme";

import {
  RiskMap,
  type MapTileStyle,
} from "../../map/components/RiskMap";

import type { Coordinates } from "../../map/types";

import {
  coordinatesLabel,
  isValidCoordinates,
  type CreateReportPayload,
} from "../reportModel";

import {
  searchAddresses,
  type AddressResult,
} from "../addressSearch";

export interface CreateReportBottomSheetProps {
  visible: boolean;
  onClose: () => void;

  onSubmit: (
    data: CreateReportPayload,
  ) => void | Promise<void>;

  initialLocation: Coordinates;
  currentAddress?: string;
  mapStyle?: MapTileStyle;
}

const INCIDENT_TYPES = [
  "Assédio",
  "Furto",
  "Violência",
  "Má iluminação",
];

const PERIODS = [
  { label: "Manhã", value: "manha" },
  { label: "Tarde", value: "tarde" },
  { label: "Noite", value: "noite" },
  { label: "Madrugada", value: "madrugada" },
];

export function CreateReportBottomSheet({
  visible,
  onClose,
  onSubmit,
  initialLocation,
  currentAddress = "Local selecionado no mapa",
  mapStyle = "streets",
}: CreateReportBottomSheetProps) {
  const { isDark } = useAppTheme();

  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates>(() => ({
      ...initialLocation,
    }));

  const [previewCenter, setPreviewCenter] =
    useState<Coordinates>(() => ({
      ...initialLocation,
    }));

  const [selectedAddress, setSelectedAddress] =
    useState(currentAddress);

  const [query, setQuery] = useState(currentAddress);
  const [addressDirty, setAddressDirty] = useState(false);

  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addressError, setAddressError] = useState("");

  const [addressDetail, setAddressDetail] = useState("");
  const [incidentType, setIncidentType] = useState("Assédio");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("noite");
  const [isAnonymous, setIsAnonymous] = useState(true);

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastSearchAtRef = useRef(0);

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      searchIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  function invalidateSearch() {
    searchIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSearching(false);
  }

  function handleClose() {
    if (submittingRef.current) return;

    invalidateSearch();
    onClose();
  }

  useEffect(() => {
    if (!visible) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!submittingRef.current) {
          searchIdRef.current += 1;
          abortRef.current?.abort();
          onClose();
        }

        return true;
      },
    );

    return () => subscription.remove();
  }, [visible, onClose]);

  async function handleSearch() {
    if (submittingRef.current) return;

    const normalized = query.trim();

    if (normalized.length < 3) {
      setAddressError(
        "Digite pelo menos 3 caracteres para buscar.",
      );
      return;
    }

    if (Date.now() - lastSearchAtRef.current < 1000) {
      setAddressError(
        "Aguarde um instante antes de buscar novamente.",
      );
      return;
    }

    lastSearchAtRef.current = Date.now();

    invalidateSearch();

    const requestId = searchIdRef.current;
    const controller = new AbortController();

    abortRef.current = controller;

    setIsSearching(true);
    setAddressError("");
    setResults([]);

    try {
      const addresses = await searchAddresses(
        normalized,
        controller.signal,
      );

      if (
        !mountedRef.current ||
        requestId !== searchIdRef.current
      ) {
        return;
      }

      setResults(addresses);

      if (!addresses.length) {
        setAddressError(
          "Nenhum endereço encontrado. Tente incluir bairro e cidade.",
        );
      }
    } catch (error) {
      if (
        !mountedRef.current ||
        requestId !== searchIdRef.current
      ) {
        return;
      }

      setAddressError(
        error instanceof Error
          ? error.message
          : "Não foi possível buscar o endereço.",
      );
    } finally {
      if (
        mountedRef.current &&
        requestId === searchIdRef.current
      ) {
        setIsSearching(false);
      }
    }
  }

  function chooseAddress(result: AddressResult) {
    invalidateSearch();

    setSelectedLocation({ ...result.location });
    setPreviewCenter({ ...result.location });

    setSelectedAddress(result.label);
    setQuery(result.label);

    setAddressDirty(false);
    setAddressError("");
    setResults([]);
  }

  function chooseMapLocation(coordinates: Coordinates) {
    if (!isValidCoordinates(coordinates)) return;

    invalidateSearch();

    const label = `Local no mapa · ${coordinatesLabel(
      coordinates,
    )}`;

    setSelectedLocation({ ...coordinates });
    setSelectedAddress(label);
    setQuery(label);

    setAddressDirty(false);
    setAddressError("");
    setResults([]);

    // Não muda o centro ao tocar:
    // a usuária continua explorando o mapa livremente.
  }

  async function handleSubmit() {
    if (submittingRef.current) return;

    setSubmitError("");

    if (addressDirty) {
      setSubmitError(
        "Busque e selecione um endereço ou toque no mapa para confirmar o local.",
      );
      return;
    }

    if (!isValidCoordinates(selectedLocation)) {
      setSubmitError(
        "Selecione uma localização válida no mapa.",
      );
      return;
    }

    const payload: CreateReportPayload = {
      category: incidentType,
      description,
      addressDetail,
      period,
      isAnonymous,

      location: { ...selectedLocation },
      address: selectedAddress,
    };

    submittingRef.current = true;
    setIsSubmitting(true);

    // Invalida qualquer busca que ainda esteja em andamento.
    invalidateSearch();

    try {
      await onSubmit(payload);
    } catch (error) {
      if (mountedRef.current) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Não foi possível publicar o relato.",
        );
      }

      submittingRef.current = false;

      if (mountedRef.current) {
        setIsSubmitting(false);
      }

      return;
    }

    submittingRef.current = false;

    if (mountedRef.current) {
      setIsSubmitting(false);
      onClose();
    }
  }

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      style={s.overlay}
      behavior={
        Platform.OS === "ios" ? "padding" : "height"
      }
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Fechar formulário"
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleClose}
      />

      <View
        style={[
          s.sheet,
          {
            backgroundColor: isDark
              ? "#2A1F45"
              : "#8055B5",
          },
        ]}
      >
        <View style={s.header}>
          <Text
            accessibilityRole="header"
            style={s.title}
          >
            Adicionar relato
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fechar formulário"
            onPress={handleClose}
            style={s.close}
          >
            <Ionicons
              name="close-outline"
              size={27}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.label}>Endereço</Text>

          <View style={s.addressCard}>
            <View style={s.searchRow}>
              <TextInput
                accessibilityLabel="Buscar endereço do relato"
                editable={!isSubmitting}
                value={query}
                onChangeText={(value) => {
                  invalidateSearch();
                  setQuery(value);
                  setAddressDirty(true);
                  setResults([]);
                  setAddressError("");
                }}
                placeholder="Selecione o endereço"
                placeholderTextColor="#81758E"
                returnKeyType="search"
                onSubmitEditing={() => {
                  void handleSearch();
                }}
                style={s.searchInput}
              />

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Buscar endereço"
                disabled={isSearching || isSubmitting}
                onPress={() => {
                  void handleSearch();
                }}
                style={s.searchButton}
              >
                {isSearching ? (
                  <ActivityIndicator
                    size="small"
                    color="#8055B5"
                  />
                ) : (
                  <Ionicons
                    name="search"
                    size={20}
                    color="#8055B5"
                  />
                )}
              </TouchableOpacity>
            </View>

            {!!addressError && (
              <Text
                accessibilityRole="alert"
                style={s.addressError}
              >
                {addressError}
              </Text>
            )}

            {!!results.length && (
              <View style={s.results}>
                {results.map((result) => (
                  <TouchableOpacity
                    key={result.id}
                    accessibilityRole="button"
                    onPress={() =>
                      chooseAddress(result)
                    }
                    style={s.result}
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#8055B5"
                    />

                    <Text style={s.resultText}>
                      {result.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.map}>
              <RiskMap
                center={previewCenter}
                zoom={17}
                mapStyle={mapStyle}
                selectedLocation={selectedLocation}
                onMapPress={chooseMapLocation}
                interactive={!isSubmitting}
              />
            </View>
          </View>

          <Text style={s.mapHint}>
            Toque no mapa para ajustar o ponto exato.
          </Text>

          <Text style={s.selectedAddress}>
            Local selecionado: {selectedAddress}
          </Text>

          <Text style={s.label}>
            Especificação do endereço (opcional)
          </Text>

          <TextInput
            editable={!isSubmitting}
            style={s.input}
            value={addressDetail}
            onChangeText={setAddressDetail}
            placeholder="Ex.: em frente ao supermercado X"
            placeholderTextColor="#8C7CA8"
            maxLength={160}
          />

          <Text style={s.label}>
            Tipo de incidente
          </Text>

          <View style={s.pillsRow}>
            {INCIDENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                disabled={isSubmitting}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: incidentType === type,
                }}
                onPress={() => setIncidentType(type)}
                style={[
                  s.pill,
                  incidentType === type &&
                    s.pillActive,
                ]}
              >
                <Text
                  style={[
                    s.pillText,
                    incidentType === type &&
                      s.pillTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Descrição</Text>

          <TextInput
            accessibilityLabel="Descrição do ocorrido"
            editable={!isSubmitting}
            style={[s.input, s.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Escreva uma pequena descrição"
            placeholderTextColor="#8C7CA8"
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <Text style={s.label}>Período</Text>

          <View style={s.pillsRow}>
            {PERIODS.map((item) => (
              <TouchableOpacity
                key={item.value}
                disabled={isSubmitting}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: period === item.value,
                }}
                onPress={() =>
                  setPeriod(item.value)
                }
                style={[
                  s.pill,
                  period === item.value &&
                    s.pillActive,
                ]}
              >
                <Text
                  style={[
                    s.pillText,
                    period === item.value &&
                      s.pillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>
            Manter anonimato?
          </Text>

          <View style={s.radioRow}>
            {[true, false].map((value) => (
              <TouchableOpacity
                key={String(value)}
                disabled={isSubmitting}
                accessibilityRole="radio"
                accessibilityLabel={
                  value
                    ? "Publicar anonimamente"
                    : "Publicar com identificação"
                }
                accessibilityState={{
                  checked: isAnonymous === value,
                }}
                onPress={() =>
                  setIsAnonymous(value)
                }
                style={s.radioOption}
              >
                <Ionicons
                  name={
                    isAnonymous === value
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color="#FFFFFF"
                />

                <Text style={s.radioText}>
                  {value ? "Sim" : "Não"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!submitError && (
            <Text
              accessibilityRole="alert"
              style={s.submitError}
            >
              {submitError}
            </Text>
          )}

          <View style={s.actions}>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleClose}
              style={s.cancel}
            >
              <Text style={s.cancelText}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isSubmitting}
              onPress={() => {
                void handleSubmit();
              }}
              style={[
                s.submit,
                isSubmitting && { opacity: 0.6 },
              ]}
            >
              <Text style={s.submitText}>
                {isSubmitting
                  ? "Publicando…"
                  : "Concluir"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    width: "94%",
    maxWidth: 500,
    maxHeight: "90%",
    borderRadius: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 25,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  label: {
    color: "#F1EAF8",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 16,
    marginBottom: 7,
  },
  addressCard: {
    backgroundColor: "#EAE4F2",
    borderRadius: 13,
    overflow: "hidden",
  },
  searchRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#4A3475",
    fontSize: 13,
  },
  searchButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addressError: {
    color: "#9F1239",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  results: {
    backgroundColor: "#FFFFFF",
  },
  result: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DDD5E8",
  },
  resultText: {
    flex: 1,
    color: "#4A3475",
    fontSize: 12,
    lineHeight: 18,
  },
  map: {
    height: 300,
    overflow: "hidden",
  },
  mapHint: {
    color: "#F1EAF8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  selectedAddress: {
    color: "#E2D9F3",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#EDE7F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#37235E",
  },
  textArea: {
    minHeight: 90,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#6D4DA8",
  },
  radioRow: {
    flexDirection: "row",
    gap: 24,
  },
  radioOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radioText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  submitError: {
    color: "#FFFFFF",
    backgroundColor: "rgba(120,0,30,0.35)",
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  cancel: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  cancelText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  submit: {
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
  submitText: {
    color: "#6D4DA8",
    fontSize: 14,
    fontWeight: "700",
  },
});