import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { RiskMap } from "../src/features/map/components/RiskMap";

import {
  DEFAULT_SP_COORDINATES,
  useCurrentLocation,
} from "../src/features/map/hooks/useCurrentLocation";

import type { Coordinates } from "../src/features/map/types";

import { AddressSearchModal } from "../src/features/routes/components/AddressSearchModal";
import { useSupportLocations } from "../src/features/shared/useScreenData";

export default function DelegaciasScreen() {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const { location } = useCurrentLocation();

  const [origin, setOrigin] = useState<Coordinates>(
    DEFAULT_SP_COORDINATES,
  );

  const [center, setCenter] = useState<Coordinates>(
    DEFAULT_SP_COORDINATES,
  );

  const [label, setLabel] = useState("Área inicial: São Paulo");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraRevision, setCameraRevision] = useState(0);

  const originChosen = useRef(false);

  useEffect(() => {
    if (!location || originChosen.current) return;

    originChosen.current = true;

    const point = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    setOrigin(point);
    setCenter(point);
    setLabel("Próximo à sua localização");
  }, [location?.latitude, location?.longitude]);

  const {
    stations,
    locations,
    loading,
    error,
    refresh,
  } = useSupportLocations(origin, {
    enabled: focused,
  });

  function chooseOrigin(point: Coordinates, title: string) {
    originChosen.current = true;

    setOrigin(point);
    setCenter(point);
    setLabel(title);
    setSelectedId(null);
    setCameraRevision(value => value + 1);
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <SafeAreaView
      style={s.screen}
      edges={["top", "left", "right"]}
    >
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={s.heading}>
            <Text style={s.title}>Delegacias e apoio</Text>
            <Text style={s.subtitle}>
              Encontre locais próximos à área escolhida.
            </Text>
          </View>

          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={s.close}
          >
            <Ionicons name="close" size={25} color="#FFFFFF" />
          </Pressable>
        </View>

        <Pressable
          style={s.search}
          onPress={() => setSearchOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Alterar endereço da busca"
        >
          <Ionicons
            name="search-outline"
            size={19}
            color="#8055B5"
          />

          <Text style={s.searchText} numberOfLines={2}>
            {label}
          </Text>

          <Ionicons
            name="chevron-down"
            size={18}
            color="#8055B5"
          />
        </Pressable>

        {/* A altura explícita permite que o Leaflet ocupe a área. */}
        <View style={s.map}>
          {focused && (
            <RiskMap
              center={center}
              cameraRevision={cameraRevision}
              zoom={14}
              mapStyle="streets"
              userLocation={location}
              selectedLocation={origin}
              supportLocations={locations}
              interactive
              onMapPress={point =>
                chooseOrigin(point, "Área selecionada no mapa")
              }
              onSelectSupportLocation={point => {
                setSelectedId(point.id);

                setCenter({
                  latitude: point.latitude,
                  longitude: point.longitude,
                });

                setCameraRevision(value => value + 1);
              }}
            />
          )}
        </View>

        <Text style={s.hint}>
          Toque no mapa ou busque um endereço para alterar a área
          da consulta.
        </Text>

        <View style={s.listHeader}>
          <Text style={s.listTitle}>Locais próximos</Text>

          <Pressable
            onPress={refresh}
            disabled={loading}
            accessibilityRole="button"
            style={s.refresh}
          >
            <Text style={s.refreshText}>
              {loading ? "Buscando…" : "Atualizar"}
            </Text>
          </Pressable>
        </View>

        {loading && (
          <ActivityIndicator
            color="#FFFFFF"
            style={s.loader}
          />
        )}

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

        {!loading && !error && stations.length === 0 && (
          <Text style={s.hint}>
            Nenhum local de apoio encontrado nesta área.
          </Text>
        )}

        {stations.map(station => (
          <Pressable
            key={station.id}
            accessibilityRole="button"
            accessibilityLabel={`Ver ${station.name} no mapa`}
            style={[
              s.card,
              selectedId === station.id && s.selectedCard,
            ]}
            onPress={() => {
              setSelectedId(station.id);
              setCenter(station.location);
              setCameraRevision(value => value + 1);
            }}
          >
            <View style={s.cardTop}>
              <Text style={s.cardTitle}>{station.name}</Text>

              <Text style={s.distance}>
                {station.distanceLabel}
              </Text>
            </View>

            <Text style={s.coordinates}>{station.address}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <AddressSearchModal
        visible={searchOpen && focused}
        initialQuery=""
        onClose={() => setSearchOpen(false)}
        onSelectAddress={address => {
          chooseOrigin(
            {
              latitude: address.latitude,
              longitude: address.longitude,
            },
            address.label,
          );

          setSearchOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#8055B5",
  },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 22,
  },
  heading: { flex: 1 },
  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "700",
  },
  subtitle: {
    color: "#F1EAF9",
    marginTop: 7,
    lineHeight: 20,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  searchText: {
    flex: 1,
    color: "#4A3475",
    fontSize: 14,
  },
  map: {
    height: 300,
    width: "100%",
    flexShrink: 0,
    overflow: "hidden",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: "#E9E4F2",
  },
  hint: {
    color: "#F1EAF9",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 16,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  listTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  refresh: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loader: { marginVertical: 14 },
  feedback: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
  feedbackText: {
    color: "#7F1D1D",
    lineHeight: 21,
  },
  retry: { alignSelf: "flex-start", paddingVertical: 12 },
  retryText: { color: "#6E47A9", fontWeight: "700" },
  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedCard: { borderColor: "#CBB5ED" },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: "#1E293B",
    fontSize: 15,
    fontWeight: "600",
  },
  distance: { color: "#6E47A9", fontWeight: "700" },
  coordinates: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 8,
  },
});