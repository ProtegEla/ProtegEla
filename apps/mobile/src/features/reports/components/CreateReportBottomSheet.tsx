import React, {
  useCallback,
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
  addressService,
  type AddressSuggestion,
} from "../../../services/api/addresses";

import {
  RiskMap,
  type MapTileStyle,
} from "../../map/components/RiskMap";

import { DEFAULT_SP_COORDINATES } from "../../map/hooks/useCurrentLocation";
import type { Coordinates } from "../../map/types";

import {
  coordinatesLabel,
  isValidCoordinates,
  type CreateReportPayload,
} from "../reportModel";

export interface CreateReportData extends CreateReportPayload {
  address: string;
  location: Coordinates & {
    address: string;
  };
}

export interface CreateReportBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateReportData,
  ) => void | Promise<void>;

  initialLocation?: Coordinates;
  currentCoordinates?: Coordinates;
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

function validLocation(
  location?: Coordinates,
): location is Coordinates {
  return Boolean(
    location && isValidCoordinates(location),
  );
}

export function CreateReportBottomSheet({
  visible,
  onClose,
  onSubmit,
  initialLocation,
  currentCoordinates,
  currentAddress = "Local selecionado no mapa",
  mapStyle = "streets",
}: CreateReportBottomSheetProps) {
  const { isDark } = useAppTheme();

  const getInitialLocation = (): Coordinates => ({
    ...(validLocation(initialLocation)
      ? initialLocation
      : validLocation(currentCoordinates)
        ? currentCoordinates
        : DEFAULT_SP_COORDINATES),
  });

  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates>(getInitialLocation);

  const [previewCenter, setPreviewCenter] =
    useState<Coordinates>(getInitialLocation);

  const [cameraRevision, setCameraRevision] = useState(0);

  const [selectedAddress, setSelectedAddress] =
    useState(currentAddress);

  const [query, setQuery] = useState(currentAddress);
  const [addressDirty, setAddressDirty] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const [results, setResults] = useState<AddressSuggestion[]>([]);
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const visibleRef = useRef(visible);
  const wasVisibleRef = useRef(false);
  const sessionIdRef = useRef(0);

  const initialSessionRef = useRef({
    location: getInitialLocation(),
    address: currentAddress,
  });

  visibleRef.current = visible;

  const invalidateSearch = useCallback(() => {
    searchIdRef.current += 1;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = null;
    setIsSearching(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      sessionIdRef.current += 1;
      searchIdRef.current += 1;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Reinicia somente ao abrir uma nova sessão.
  // Atualizações do GPS não sobrescrevem o rascunho.
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const location = getInitialLocation();

      initialSessionRef.current = {
        location,
        address: currentAddress,
      };

      sessionIdRef.current += 1;

      invalidateSearch();

      setSelectedLocation(location);
      setPreviewCenter(location);
      setSelectedAddress(currentAddress);
      setQuery(currentAddress);

      setAddressDirty(false);
      setIsEditingAddress(false);
      setResults([]);
      setAddressError("");

      setAddressDetail("");
      setIncidentType("Assédio");
      setDescription("");
      setPeriod("noite");
      setIsAnonymous(true);

      setSubmitError("");
      submittingRef.current = false;
      setIsSubmitting(false);
    }

    if (!visible) {
      invalidateSearch();
    }

    wasVisibleRef.current = visible;
  }, [
    visible,
    currentAddress,
    initialLocation?.latitude,
    initialLocation?.longitude,
    currentCoordinates?.latitude,
    currentCoordinates?.longitude,
    invalidateSearch,
  ]);

  const handleClose = useCallback(() => {
    if (submittingRef.current) return;

    invalidateSearch();
    onClose();
  }, [invalidateSearch, onClose]);

  useEffect(() => {
    if (!visible) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleClose();
        return true;
      },
    );

    return () => subscription.remove();
  }, [visible, handleClose]);

  const runSearch = useCallback(
    async (value: string) => {
      if (
        !visibleRef.current ||
        submittingRef.current
      ) {
        return;
      }

      invalidateSearch();

      const normalized = value.trim();

      if (normalized.length < 3) {
        setResults([]);
        setAddressError(
          "Digite pelo menos 3 caracteres para buscar.",
        );
        return;
      }

      const requestId = searchIdRef.current;

      setIsSearching(true);
      setAddressError("");
      setResults([]);

      try {
        const suggestions =
          await addressService.getSuggestions(
            normalized,
            4,
          );

        if (
          !mountedRef.current ||
          !visibleRef.current ||
          requestId !== searchIdRef.current
        ) {
          return;
        }

        const validSuggestions =
          Array.isArray(suggestions)
            ? suggestions.filter((item) =>
                validLocation({
                  latitude: Number(item.latitude),
                  longitude: Number(item.longitude),
                }),
              )
            : [];

        setResults(validSuggestions);

        if (!validSuggestions.length) {
          setAddressError(
            "Nenhum endereço encontrado. Inclua bairro e cidade.",
          );
        }
      } catch (error) {
        if (
          !mountedRef.current ||
          !visibleRef.current ||
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
          visibleRef.current &&
          requestId === searchIdRef.current
        ) {
          setIsSearching(false);
        }
      }
    },
    [invalidateSearch],
  );

  useEffect(() => {
    if (
      !visible ||
      !isEditingAddress ||
      !addressDirty ||
      isSubmitting ||
      query.trim().length < 3
    ) {
      return;
    }

    timerRef.current = setTimeout(() => {
      void runSearch(query);
    }, 350);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = null;
    };
  }, [
    query,
    isEditingAddress,
    addressDirty,
    visible,
    isSubmitting,
    runSearch,
  ]);

  function chooseLocation(
    coordinates: Coordinates,
    label: string,
    recenter: boolean,
  ) {
    if (
      !validLocation(coordinates) ||
      submittingRef.current
    ) {
      return;
    }

    invalidateSearch();

    setSelectedLocation({ ...coordinates });

    if (recenter) {
      setPreviewCenter({ ...coordinates });
      setCameraRevision((value) => value + 1);
    }

    setSelectedAddress(label);
    setQuery(label);

    setAddressDirty(false);
    setIsEditingAddress(false);
    setAddressError("");
    setResults([]);
  }

  function chooseAddress(result: AddressSuggestion) {
    chooseLocation(
      {
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
      },
      result.label,
      true,
    );
  }

  function chooseMapLocation(coordinates: Coordinates) {
    chooseLocation(
      coordinates,
      `Local no mapa · ${coordinatesLabel(coordinates)}`,
      false,
    );
  }

  function resetToCurrentLocation() {
    const coordinates = validLocation(currentCoordinates)
      ? currentCoordinates
      : initialSessionRef.current.location;

    const label = validLocation(currentCoordinates)
      ? `Localização atual · ${coordinatesLabel(coordinates)}`
      : initialSessionRef.current.address;

    chooseLocation(coordinates, label, true);
  }

  function toggleAddressEditing() {
    invalidateSearch();
    setResults([]);
    setAddressError("");

    if (isEditingAddress) {
      setQuery(selectedAddress);
      setAddressDirty(false);
      setIsEditingAddress(false);
    } else {
      setQuery("");
      setAddressDirty(false);
      setIsEditingAddress(true);
    }
  }

  async function handleSubmit() {
    if (submittingRef.current) return;

    setSubmitError("");

    if (addressDirty) {
      setSubmitError(
        "Selecione um resultado da busca ou toque no mapa para confirmar o endereço.",
      );
      return;
    }

    if (!validLocation(selectedLocation)) {
      setSubmitError(
        "Selecione uma localização válida no mapa.",
      );
      return;
    }

    const normalizedDescription = description.trim();

    if (
      normalizedDescription.length < 10 ||
      normalizedDescription.length > 1000
    ) {
      setSubmitError(
        "Descreva o ocorrido com 10 a 1.000 caracteres.",
      );
      return;
    }

    const address =
      selectedAddress.trim() ||
      `Local no mapa · ${coordinatesLabel(selectedLocation)}`;

    const payload: CreateReportData = {
      category: incidentType,
      description: normalizedDescription,
      addressDetail: addressDetail.trim(),
      period,
      isAnonymous,
      address,
      location: {
        ...selectedLocation,
        address,
      },
    };

    const sessionId = sessionIdRef.current;

    submittingRef.current = true;
    setIsSubmitting(true);
    invalidateSearch();

    try {
      await onSubmit(payload);
    } catch (error) {
      if (
        !mountedRef.current ||
        sessionId !== sessionIdRef.current
      ) {
        return;
      }

      setSubmitError(
        error instanceof Error
          ? error.message
          : "Não foi possível publicar o relato.",
      );

      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (
      !mountedRef.current ||
      sessionId !== sessionIdRef.current
    ) {
      return;
    }

    submittingRef.current = false;
    setIsSubmitting(false);

    if (visibleRef.current) {
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
          <View style={s.locationLabelRow}>
            <Text
              style={[
                s.label,
                { marginTop: 0, marginBottom: 0 },
              ]}
            >
              Local do incidente
            </Text>

            <TouchableOpacity
              disabled={isSubmitting}
              onPress={toggleAddressEditing}
              accessibilityRole="button"
              accessibilityLabel={
                isEditingAddress
                  ? "Cancelar busca de endereço"
                  : "Alterar local do incidente"
              }
              style={s.changeAddressButton}
            >
              <Ionicons
                name={
                  isEditingAddress
                    ? "close-outline"
                    : "create-outline"
                }
                size={15}
                color="#FFFFFF"
              />
              <Text style={s.changeAddressText}>
                {isEditingAddress
                  ? "Cancelar busca"
                  : "Alterar local"}
              </Text>
            </TouchableOpacity>
          </View>

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
                  setIsEditingAddress(true);
                  setResults([]);
                  setAddressError("");
                }}
                placeholder="Selecione o endereço"
                placeholderTextColor="#81758E"
                returnKeyType="search"
                onSubmitEditing={() => {
                  void runSearch(query);
                }}
                style={s.searchInput}
              />

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Buscar endereço"
                disabled={isSearching || isSubmitting}
                onPress={() => {
                  void runSearch(query);
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
                cameraRevision={cameraRevision}
                zoom={17}
                mapStyle={mapStyle}
                selectedLocation={selectedLocation}
                onMapPress={chooseMapLocation}
                interactive={!isSubmitting}
              />
            </View>
          </View>

          <View style={s.locationTools}>
            <Text
              style={[
                s.mapHint,
                { flex: 1, marginTop: 0 },
              ]}
            >
              Toque no mapa para ajustar o ponto exato.
            </Text>

            <TouchableOpacity
              disabled={isSubmitting}
              onPress={resetToCurrentLocation}
              accessibilityRole="button"
              accessibilityLabel="Usar localização atual ou local inicial"
              style={s.resetLocationButton}
            >
              <Ionicons
                name="navigate-outline"
                size={15}
                color="#FFFFFF"
              />
              <Text style={s.changeAddressText}>
                {validLocation(currentCoordinates)
                  ? "Usar local atual"
                  : "Usar local inicial"}
              </Text>
            </TouchableOpacity>
          </View>

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
  locationLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
    marginBottom: 7,
  },
  changeAddressButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  changeAddressText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  locationTools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  resetLocationButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
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
    marginTop: 6,
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