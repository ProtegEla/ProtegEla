import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

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
  Alert,
} from "react-native";

import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { theme, useAppTheme } from "../src/theme";
import { BottomNavigation, ProfileMenuItem } from "../src/components/ui";
import { useAuth } from "../src/features/auth/AuthContext";

import {
  RiskMap,
  type MapTileStyle,
} from "../src/features/map/components/RiskMap";

import {
  useCurrentLocation,
  DEFAULT_SP_COORDINATES,
} from "../src/features/map/hooks/useCurrentLocation";

import type {
  SupportLocation,
  Coordinates,
} from "../src/features/map/types";

import { supportLocationsService } from "../src/services/api/supportLocations";
import { riskZonesService } from "../src/services/api/riskZones";

import {
  CreateReportBottomSheet,
  type CreateReportData,
} from "../src/features/reports/components/CreateReportBottomSheet";

import type { AddressSuggestion } from "../src/services/api/addresses";

import {
  routesService,
  type RouteOption,
} from "../src/services/api/routes";

import { AddressSearchModal } from "../src/features/routes/components/AddressSearchModal";
import { RoutePlanningBar } from "../src/features/routes/components/RoutePlanningBar";
import { RouteOptionsBottomSheet } from "../src/features/routes/components/RouteOptionsBottomSheet";
import { ActiveNavigationOverlay } from "../src/features/routes/components/ActiveNavigationOverlay";
import { useRouteNavigation } from "../src/features/routes/hooks/useRouteNavigation";

import { useHomeReports } from "../src/features/reports/useHomeReports";
import { DangerPointDetailsModal } from "../src/features/reports/components/DangerPointDetailsModal";

import {
  isValidCoordinates,
  type DangerReport,
} from "../src/features/reports/reportModel";

export default function HomeScreen() {
  const router = useRouter();

  const { colors, isDark, toggleTheme } = useAppTheme();
  const { isLoggedIn, user, logout, updateNickname } = useAuth();

  const nickname = user?.nickname || "Maria";
  const email = user?.email || "maria.lopez@gmail.com";

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { location, refreshLocation } = useCurrentLocation();
  const currentCoords = location || DEFAULT_SP_COORDINATES;

  const [mapCenter, setMapCenter] = useState<Coordinates>(currentCoords);
  const [mapZoom, setMapZoom] = useState(16);
  const [cameraRevision, setCameraRevision] = useState(0);

  const [selectedAddressInfo, setSelectedAddressInfo] = useState<{
    label: string;
    coords: Coordinates;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const [isRouteMode, setIsRouteMode] = useState(false);
  const [calculatedRoutes, setCalculatedRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);
  const [routeComparison, setRouteComparison] = useState<any>(null);
  const [routeError, setRouteError] = useState("");

  const [reportAddressSnapshot, setReportAddressSnapshot] = useState("");

  const reportFlow = useHomeReports({
    currentCoords,
    hasUserLocation: Boolean(location),
    authorName: user?.nickname || "Você",
  });

  const routeRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      routeRequestRef.current += 1;
    };
  }, []);

  const handleFollowNavigationLocation = useCallback(
    (coords: Coordinates) => {
      setMapCenter(coords);
      setMapZoom(17);
    },
    [],
  );

  const navigation = useRouteNavigation({
    currentLocation: location,
    onFollowLocation: handleFollowNavigationLocation,
  });

  const mapRoutes = useMemo(() => {
    const source =
      navigation.isNavigating && navigation.activeRoute
        ? [navigation.activeRoute]
        : calculatedRoutes;

    return source.map((route) => ({
      id: route.id,
      coordinates: route.coordinates,
      color: route.tagBgColor,
      isSelected: route.id === selectedRouteId || navigation.isNavigating,
    }));
  }, [
    calculatedRoutes,
    selectedRouteId,
    navigation.isNavigating,
    navigation.activeRoute,
  ]);

  useEffect(() => {
    if (
      location &&
      !selectedAddressInfo &&
      !isRouteMode &&
      !reportFlow.creationSession
    ) {
      setMapCenter(location);
    }
  }, [
    location?.latitude,
    location?.longitude,
    selectedAddressInfo,
    isRouteMode,
    Boolean(reportFlow.creationSession),
  ]);

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

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    const coords: Coordinates = {
      latitude: item.latitude,
      longitude: item.longitude,
    };

    if (!isValidCoordinates(coords)) return;

    routeRequestRef.current += 1;

    setSearchQuery(item.label);
    setIsCalculatingRoutes(false);
    setCalculatedRoutes([]);
    setSelectedRouteId(null);
    setRouteComparison(null);
    setRouteError("");
    setIsRouteMode(false);
    setIsSearchModalOpen(false);

    reportFlow.selectLocation(coords);

    setSelectedAddressInfo({
      label: item.label,
      coords,
    });

    setMapCenter(coords);
    setMapZoom(17);
    setCameraRevision((value) => value + 1);
  };

  const handleClearSearch = () => {
    routeRequestRef.current += 1;

    setIsCalculatingRoutes(false);
    setRouteComparison(null);
    setRouteError("");
    setSearchQuery("");
    setSelectedAddressInfo(null);
    setIsRouteMode(false);
    setCalculatedRoutes([]);
    setSelectedRouteId(null);

    reportFlow.clearSelection();

    setMapCenter(currentCoords);
    setMapZoom(16);
    setCameraRevision((value) => value + 1);
  };

  const handleTriggerRouteCalculation = async (
    destCoords: Coordinates,
    destLabel: string,
  ) => {
    if (!isValidCoordinates(destCoords)) return;

    const requestId = ++routeRequestRef.current;

    setSelectedAddressInfo({
      label: destLabel,
      coords: { ...destCoords },
    });

    setIsRouteMode(true);
    setIsCalculatingRoutes(true);
    setCalculatedRoutes([]);
    setSelectedRouteId(null);
    setRouteComparison(null);
    setRouteError("");

    // O centro padrão não representa a localização da usuária.
    if (!location || !isValidCoordinates(location)) {
      setIsCalculatingRoutes(false);
      setRouteError(
        "Ative sua localização para calcular a rota a partir do GPS.",
      );
      return;
    }

    const origin = { ...location };

    try {
      const result = await routesService.calculateRoutes({
        origin,
        destination: destCoords,
      });

      if (
        !mountedRef.current ||
        requestId !== routeRequestRef.current
      ) {
        return;
      }

      const routes = Array.isArray(result.routes)
        ? result.routes
        : [];

      setCalculatedRoutes(routes);
      setRouteComparison(result.comparison);
      setSelectedRouteId(routes[0]?.id ?? null);

      if (!routes.length) {
        setRouteError(
          "Nenhuma rota encontrada para este destino.",
        );
      }
    } catch (error: any) {
      if (
        mountedRef.current &&
        requestId === routeRequestRef.current
      ) {
        const message =
          error?.response?.data?.error?.message ||
          error?.message ||
          "Não foi possível calcular as rotas. Tente novamente.";
        setRouteError(message);
      }
    } finally {
      if (
        mountedRef.current &&
        requestId === routeRequestRef.current
      ) {
        setIsCalculatingRoutes(false);
      }
    }
  };

  const handleExitRouteMode = () => {
    routeRequestRef.current += 1;

    void navigation.stopNavigation();
    setIsCalculatingRoutes(false);
    setRouteError("");
    setIsRouteMode(false);
    setCalculatedRoutes([]);
    setSelectedRouteId(null);
    setRouteComparison(null);
  };

  const handleStartNavigation = () => {
    const route = calculatedRoutes.find(
      (item) => item.id === selectedRouteId,
    );

    if (!route) {
      const message = "Selecione uma rota calculada primeiro.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Rotas", message);
      }

      return;
    }

    const destTitle =
      selectedAddressInfo?.label.split(",")[0] || "Destino";
    void navigation.startNavigation(route, destTitle);
  };

  const handleRecentralizeGps = () => {
    void refreshLocation();

    routeRequestRef.current += 1;

    setIsRouteMode(false);
    setIsCalculatingRoutes(false);
    setCalculatedRoutes([]);
    setSelectedRouteId(null);
    setRouteComparison(null);
    setRouteError("");
    setSelectedAddressInfo(null);
    setSearchQuery("");

    reportFlow.clearSelection();
    reportFlow.recenterMap();

    setMapCenter(currentCoords);
    setMapZoom(16);
    setCameraRevision((value) => value + 1);
  };

  const handleMapClick = (coords: Coordinates) => {
    if (isRouteMode || !isValidCoordinates(coords)) return;

    reportFlow.selectLocation(coords);

    const label =
      `Ponto no mapa (${coords.latitude.toFixed(4)}, ` +
      `${coords.longitude.toFixed(4)})`;

    setSelectedAddressInfo({ label, coords });
    setMapCenter(coords);
    setSearchQuery(label);
  };

  const handleOpenReport = () => {
    setReportAddressSnapshot(
      selectedAddressInfo?.label ||
        (location
          ? "Minha localização atual (GPS)"
          : "Centro inicial do mapa"),
    );

    reportFlow.openCreateReport();
  };

  const handleCreateReport = async (data: CreateReportData) => {
    if (!isValidCoordinates(data.location)) {
      throw new Error("Selecione uma localização válida.");
    }

    await reportFlow.createReport({
      ...data,
      address: data.address || data.location.address,
    });

    const coords: Coordinates = {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
    };

    const label = data.address || data.location.address;

    setSelectedAddressInfo({ label, coords });
    setSearchQuery(label);
    setMapCenter(coords);
    setMapZoom(17);
    setCameraRevision((value) => value + 1);
  };

  const mapStyle: MapTileStyle = isDark
    ? "clean_dark"
    : "clean";

  const [supportLocations, setSupportLocations] =
    useState<SupportLocation[]>([]);
  const [sspReports, setSspReports] = useState<DangerReport[]>([]);
  const [selectedSspReport, setSelectedSspReport] =
    useState<DangerReport | null>(null);

  const lastFetchedCoordsRef = useRef<Coordinates | null>(null);
  const supportCacheRef = useRef<SupportLocation[]>([]);
  const isFetchingSupportRef = useRef(false);

  const haversineDistanceM = useCallback(
    (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number => {
      const R = 6_371_000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;

      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const coordinates: Coordinates = {
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
    };

    const previous = lastFetchedCoordsRef.current;

    if (
      previous &&
      haversineDistanceM(
        previous.latitude,
        previous.longitude,
        coordinates.latitude,
        coordinates.longitude,
      ) < 500
    ) {
      return;
    }

    if (isFetchingSupportRef.current) return;

    const timer = setTimeout(() => {
      isFetchingSupportRef.current = true;
      lastFetchedCoordsRef.current = coordinates;

      supportLocationsService
        .getNearby({
          ...coordinates,
          radius_meters: 5000,
        })
        .then((data) => {
          if (!active) return;
          const list = Array.isArray(data) ? data : [];
          supportCacheRef.current = list;
          setSupportLocations(list);
        })
        .catch((error) => {
          if (active) {
            console.warn(
              "Não foi possível carregar os locais de apoio.",
              error,
            );
          }
        })
        .finally(() => {
          isFetchingSupportRef.current = false;
        });

      riskZonesService
        .getNearby(coordinates)
        .then((zones) => {
          if (active) {
            setSspReports(riskZonesService.toDangerReports(zones));
          }
        })
        .catch(() => {
          // Zonas são complementares; não bloqueia o mapa em caso de falha transitória
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    currentCoords.latitude,
    currentCoords.longitude,
    haversineDistanceM,
  ]);

  const combinedReports = useMemo(
    () => [...reportFlow.reports, ...sspReports],
    [reportFlow.reports, sspReports],
  );

  const handleSelectMapReport = useCallback(
    (report: DangerReport) => {
      if (report.id.startsWith("ssp-")) {
        setSelectedSspReport(report);
      } else {
        setSelectedSspReport(null);
        reportFlow.selectReport(report);
      }
    },
    [reportFlow],
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: colors.screenBackground },
      ]}
    >
      <View style={styles.mainContainer}>
        <View
          style={[
            styles.mapArea,
            {
              backgroundColor: isDark ? "#171022" : "#F8FAFC",
              borderColor: colors.border,
            },
          ]}
        >
          <RiskMap<DangerReport>
            center={mapCenter}
            zoom={mapZoom}
            cameraRevision={cameraRevision}
            userLocation={location}
            selectedLocation={
              isRouteMode
                ? null
                : (selectedAddressInfo?.coords ?? null)
            }
            destinationLocation={
              isRouteMode
                ? selectedAddressInfo?.coords
                : null
            }
            routes={mapRoutes}
            selectedRouteId={selectedRouteId}
            mapStyle={mapStyle}
            supportLocations={supportLocations}
            reports={combinedReports}
            onMapPress={handleMapClick}
            onSelectReport={handleSelectMapReport}
          />
        </View>

        {isRouteMode ? (
          navigation.isNavigating && navigation.activeRoute ? null : (
            <RoutePlanningBar
              originLabel={
                location
                  ? "Localização atual (GPS)"
                  : "Localização indisponível"
              }
              destinationLabel={
                selectedAddressInfo?.label.split(",")[0] || "Destino"
              }
              onClose={handleExitRouteMode}
              onEditDestination={() => setIsSearchModalOpen(true)}
              onStartRoute={handleStartNavigation}
            />
          )
        ) : (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.searchWrapper}
              activeOpacity={0.9}
              onPress={() => setIsSearchModalOpen(true)}
            >
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
                  style={[
                    styles.searchInput,
                    { color: colors.text },
                  ]}
                  value={searchQuery}
                  editable={false}
                  pointerEvents="none"
                />

                {!!searchQuery.length && (
                  <TouchableOpacity
                    onPress={handleClearSearch}
                    hitSlop={8}
                    accessibilityLabel="Limpar busca"
                    style={{ marginRight: 4 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>

            {isLoggedIn ? (
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: isDark ? "#241B38" : "#EDE9F5",
                  },
                ]}
                onPress={() => setIsDrawerOpen(true)}
                activeOpacity={0.7}
                accessibilityLabel="Abrir menu de perfil"
              >
                <Ionicons
                  name="menu"
                  size={24}
                  color={colors.primaryPurple}
                />
              </TouchableOpacity>
            ) : (
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
        )}

        {!isRouteMode && !selectedAddressInfo && (
          <View style={styles.fabsContainer}>
            <TouchableOpacity
              style={[
                styles.fabSmall,
                {
                  backgroundColor: isDark ? "#241B38" : "#EDE9F5",
                },
              ]}
              activeOpacity={0.8}
              onPress={handleRecentralizeGps}
              accessibilityLabel="Recentralizar mapa"
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={24}
                color={colors.primaryPurple}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.fabPrimary,
                { backgroundColor: colors.primaryPurple },
              ]}
              activeOpacity={0.85}
              onPress={handleOpenReport}
              accessibilityLabel="Adicionar relato de risco"
            >
              <Ionicons name="warning" size={22} color="#FFFFFF" />
              <Text style={styles.fabPlusSign}>+</Text>
            </TouchableOpacity>
          </View>
        )}

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
              <View style={styles.drawerHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditingNickname(false);
                    setIsDrawerOpen(false);
                  }}
                  hitSlop={12}
                  accessibilityLabel="Fechar menu"
                >
                  <Ionicons
                    name="close"
                    size={28}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.drawerScroll}
              >
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
                            {
                              backgroundColor: colors.primaryPurple,
                            },
                          ]}
                          onPress={handleSaveInlineNickname}
                          accessibilityLabel="Salvar apelido"
                        >
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#FFFFFF"
                          />
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
                          <Ionicons
                            name="pencil"
                            size={13}
                            color="#FFFFFF"
                          />
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

                <View style={styles.menuItemsList}>
                  <ProfileMenuItem
                    label="Configurações"
                    onPress={() => {
                      setIsDrawerOpen(false);
                      router.push("/settings");
                    }}
                  />

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

        {reportFlow.creationSession && (
          <CreateReportBottomSheet
            key={reportFlow.creationSession.id}
            visible
            initialLocation={reportFlow.creationSession.location}
            currentCoordinates={location ?? undefined}
            currentAddress={
              reportAddressSnapshot ||
              reportFlow.creationSession.address
            }
            mapStyle={mapStyle}
            onClose={reportFlow.closeCreateReport}
            onSubmit={handleCreateReport}
          />
        )}

        <DangerPointDetailsModal
          report={selectedSspReport ?? reportFlow.selectedReport}
          onClose={() => {
            setSelectedSspReport(null);
            reportFlow.closeDetails();
          }}
          onToggleConfirmation={reportFlow.toggleConfirmation}
          onAddComment={reportFlow.addComment}
        />

        {!isRouteMode && selectedAddressInfo && (
          <View style={styles.destinationCardContainer}>
            <View
              style={[
                styles.destinationCard,
                {
                  backgroundColor: isDark
                    ? colors.surface
                    : "#FFFFFF",
                  borderColor: isDark
                    ? colors.border
                    : "#E2D9F3",
                },
              ]}
            >
              <View style={styles.destinationCardTextCol}>
                <Text
                  style={[
                    styles.destinationCardTitle,
                    { color: colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {selectedAddressInfo.label.split(",")[0]}
                </Text>

                <Text
                  style={[
                    styles.destinationCardSubtitle,
                    { color: colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {selectedAddressInfo.label
                    .split(",")
                    .slice(1)
                    .join(", ")
                    .trim()}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.reportIconBtn,
                  {
                    backgroundColor: isDark
                      ? colors.inputBackground
                      : "#F3EEF9",
                    borderColor: isDark
                      ? colors.border
                      : "#D8CCF0",
                  },
                ]}
                activeOpacity={0.8}
                onPress={handleOpenReport}
                accessibilityLabel="Relatar ocorrência neste local"
              >
                <Ionicons
                  name="warning"
                  size={18}
                  color={colors.primaryPurple}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.routeActionBtn,
                  { backgroundColor: colors.primaryPurple },
                ]}
                activeOpacity={0.85}
                onPress={() =>
                  handleTriggerRouteCalculation(
                    selectedAddressInfo.coords,
                    selectedAddressInfo.label,
                  )
                }
              >
                <Ionicons
                  name="navigate"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.routeActionBtnText}>
                  Traçar Rota
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeDestinationBtn}
                onPress={handleClearSearch}
                accessibilityLabel="Desmarcar local"
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isRouteMode && !!routeError && (
          <View
            style={[
              styles.routeError,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              accessibilityRole="alert"
              style={{ color: colors.text, flex: 1 }}
            >
              {routeError}
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                if (selectedAddressInfo) {
                  void handleTriggerRouteCalculation(
                    selectedAddressInfo.coords,
                    selectedAddressInfo.label,
                  );
                }
              }}
              style={{ padding: 10 }}
            >
              <Text
                style={{
                  color: colors.primaryPurple,
                  fontWeight: "700",
                }}
              >
                Tentar novamente
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isRouteMode &&
          (navigation.isNavigating && navigation.activeRoute ? (
            <ActiveNavigationOverlay
              route={navigation.activeRoute}
              destinationLabel={navigation.destinationLabel}
              progress={navigation.progress}
              backgroundNotice={navigation.backgroundNotice}
              onStopNavigation={() => {
                void navigation.stopNavigation();
              }}
            />
          ) : (
            <RouteOptionsBottomSheet
              routes={calculatedRoutes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              loading={isCalculatingRoutes}
              exceeds30Percent={
                routeComparison?.exceeds_30_percent
              }
            />
          ))}

        <AddressSearchModal
          visible={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectAddress={handleSelectSuggestion}
          initialQuery={searchQuery}
        />
      </View>

      <BottomNavigation
        onTabPress={(tab) => router.push(tab)}
        onPanicPress={() => router.push("/emergency")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  routeError: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    zIndex: 30,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
    zIndex: 20,
  },
  searchWrapper: {
    flex: 1,
    position: "relative",
    zIndex: 30,
  },
  suggestionsDropdown: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    maxHeight: 240,
    overflow: "hidden",
    zIndex: 50,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.typography.fontFamily,
  },
  searchPill: {
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

  reportHint: {
    position: "absolute",
    top: 76,
    left: 16,
    right: 16,
    maxWidth: 480,
    zIndex: 11,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,

    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  reportHintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  reportHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  reportTestButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },

  reportTestText: {
    fontSize: 12,
    fontWeight: "700",
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

  // Card de confirmação de destino antes do modo rota
  destinationCardContainer: {
    position: "absolute",
    // Mesmo nível dos FABs, na borda inferior do mapArea (antes da navbar)
    bottom: theme.spacing.md,
    left: 16,
    right: 16,
    zIndex: 25,
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  destinationCardTextCol: {
    flex: 1,
    marginRight: 10,
  },
  destinationCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  destinationCardSubtitle: {
    fontSize: 12,
  },
  routeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginRight: 6,
  },
  routeActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  closeDestinationBtn: {
    padding: 6,
  },
  reportIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginRight: 6,
  },
});
