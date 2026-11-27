import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/ui/BottomNavigation';
import { RiskMap } from '../src/features/map/components/RiskMap';
import { useAppTheme } from '../src/theme';
import {
  DEFAULT_SP_COORDINATES,
  useCurrentLocation,
} from '../src/features/map/hooks/useCurrentLocation';
import type { SupportLocation } from '../src/features/map/types';
import { supportLocationsService } from '../src/services/api/supportLocations';
import {
  getCachedSupportLocations,
  setCachedSupportLocations,
} from '../src/storage/mapCache';

export type PoliceStation = {
  id: string;
  name: string;
  address: string;
  distanceLabel?: string;
  specialized?: boolean;
  latitude?: number;
  longitude?: number;
};

type Props = {
  onClose?: () => void;
  stations?: PoliceStation[] | null;
  addressLabel?: string;
  onSelectAddress?: () => void;
  onSelectStation?: (station: PoliceStation) => void;
  mapContent?: React.ReactNode;
};

// Dados fictícios apenas para visualizar a interface.
const PLACEHOLDER_STATIONS: PoliceStation[] = [
  {
    id: 'placeholder-1',
    name: 'Delegacia de Polícia',
    address: 'Rua Exemplo, 123 · Centro',
    distanceLabel: '4 km',
  },
  {
    id: 'placeholder-2',
    name: 'Delegacia da Mulher',
    address: 'Avenida Exemplo, 456 · Vila Nova',
    distanceLabel: '7 km',
    specialized: true,
  },
  {
    id: 'placeholder-3',
    name: 'Delegacia de Polícia — Unidade Sul',
    address: 'Praça Exemplo, 789 · Jardim Sul',
    distanceLabel: '8 km',
  },
];

export default function PoliceStationsScreen({
  onClose,
  stations,
  addressLabel = 'Sua localização atual (GPS)',
  onSelectAddress,
  onSelectStation,
  mapContent,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const { location, loading: locationLoading } = useCurrentLocation();
  const centerCoords = location || DEFAULT_SP_COORDINATES;
  const [liveStations, setLiveStations] = useState<SupportLocation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  useEffect(() => {
    if (Array.isArray(stations)) return;
    if (!location && locationLoading) return;
    let active = true;

    getCachedSupportLocations(centerCoords).then((cached) => {
      if (!active) return;
      if (cached?.items.length) {
        setLiveStations(cached.items);
      }
      if (cached?.fresh) return;

      setLoadingStations(!cached?.items.length);
      supportLocationsService
        .getNearby({
          latitude: centerCoords.latitude,
          longitude: centerCoords.longitude,
          radius_meters: 5000,
        })
        .then((data) => {
          if (!active) return;
          const list = Array.isArray(data) ? data : [];
          if (list.length > 0) {
            setLiveStations(list);
            void setCachedSupportLocations(centerCoords, list);
          }
        })
        .catch(() => {
          if (active && !cached?.items.length) setLiveStations([]);
        })
        .finally(() => {
          if (active) setLoadingStations(false);
        });
    });

    return () => {
      active = false;
    };
  }, [stations, location, locationLoading, centerCoords.latitude, centerCoords.longitude]);

  const stationList: PoliceStation[] = Array.isArray(stations)
    ? stations
    : liveStations.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address || 'Unidade policial próxima (OpenStreetMap)',
        distanceLabel:
          typeof item.distance_meters === 'number'
            ? `${(item.distance_meters / 1000).toFixed(1).replace('.', ',')} km`
            : undefined,
        specialized: /mulher|ddm/i.test(item.name),
        latitude: item.latitude,
        longitude: item.longitude,
      }));

  function handleStationPress(station: PoliceStation) {
    if (onSelectStation) {
      onSelectStation(station);
      return;
    }
    if (
      typeof station.latitude === 'number' &&
      typeof station.longitude === 'number'
    ) {
      router.replace({
        pathname: '/',
        params: {
          focusLat: String(station.latitude),
          focusLon: String(station.longitude),
          focusLabel: station.name,
        },
      });
    } else {
      router.replace('/');
    }
  }

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      router.replace('/');
    }
  }

  const themeStyles = {
    screen: { backgroundColor: isDark ? '#2A1B46' : '#7450A5' },
    body: { backgroundColor: isDark ? colors.screenBackground : '#F7F5FB' },
    card: {
      backgroundColor: isDark ? colors.cardBackground : '#FFFFFF',
      borderColor: isDark ? colors.border : '#E9E2F0',
    },
    titleText: { color: isDark ? colors.text : '#30243F' },
    mutedText: { color: isDark ? colors.textMuted : '#71687D' },
    badge: { backgroundColor: isDark ? colors.primaryLight : '#EEE7F6' },
    badgeText: { color: isDark ? colors.primaryDark : '#503273' },
  };

  return (
    <SafeAreaView style={[s.screen, themeStyles.screen]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View style={s.navigation}>
            <Text style={s.eyebrow}>REDE DE APOIO</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar delegacias"
              onPress={handleClose}
              style={({ pressed }) => [
                s.close,
                pressed && s.pressed,
              ]}
            >
              <Text style={s.closeText}>X</Text>
            </Pressable>
          </View>

          <Text accessibilityRole="header" style={s.title}>
            Delegacias
          </Text>

          <Text style={s.subtitle}>
            Consulte as unidades e encontre um local de atendimento.
          </Text>
        </View>

        <View style={[s.body, themeStyles.body]}>
          <View style={s.content}>
            <View style={[s.mapCard, themeStyles.card]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Selecionar endereço. ${addressLabel}`}
                disabled={!onSelectAddress}
                onPress={onSelectAddress}
                style={({ pressed }) => [
                  s.address,
                  pressed && s.pressed,
                ]}
              >
                <View style={s.addressContent}>
                  <Text style={[s.fieldLabel, themeStyles.mutedText]}>
                    ENDEREÇO DE REFERÊNCIA
                  </Text>
                  <Text style={[s.addressValue, themeStyles.titleText]}>{addressLabel}</Text>
                </View>

                {onSelectAddress && (
                  <Text style={[s.arrow, { color: isDark ? colors.primaryDark : '#7450A5' }]}>⌄</Text>
                )}
              </Pressable>

              <View style={[s.mapContainer, { backgroundColor: isDark ? '#171022' : '#F0EBF7' }]}>
                {mapContent ?? (
                  <RiskMap
                    center={centerCoords}
                    zoom={14}
                    userLocation={location}
                    supportLocations={liveStations}
                    mapStyle={isDark ? 'clean_dark' : 'clean'}
                    interactive={false}
                  />
                )}
              </View>
            </View>

            <View style={s.sectionHeader}>
              <Text accessibilityRole="header" style={[s.sectionTitle, themeStyles.titleText]}>
                Unidades
              </Text>

              <View style={[s.countBadge, themeStyles.badge]}>
                <Text style={[s.countText, themeStyles.badgeText]}>
                  {loadingStations ? '...' : stationList.length}
                </Text>
              </View>
            </View>

            {loadingStations && (
              <View style={[s.card, themeStyles.card, { alignItems: 'center' }]}>
                <ActivityIndicator size="small" color={colors.primaryPurple} />
                <Text style={[s.description, themeStyles.mutedText]}>
                  Buscando delegacias próximas à sua localização...
                </Text>
              </View>
            )}

            {stationList.map(station => {
              const content = (
                <>
                  <View style={s.row}>
                    <Text style={[s.cardTitle, themeStyles.titleText]}>{station.name}</Text>

                    {station.distanceLabel && (
                      <View style={[s.distanceBadge, { backgroundColor: isDark ? '#241B38' : '#F3EFF8' }]}>
                        <Text style={[s.distanceText, themeStyles.badgeText]}>
                          {station.distanceLabel}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={[s.description, themeStyles.mutedText]}>{station.address}</Text>

                  {station.specialized && (
                    <View style={[s.specializedBadge, themeStyles.badge]}>
                      <Text style={[s.specializedText, themeStyles.badgeText]}>
                        Atendimento à mulher
                      </Text>
                    </View>
                  )}
                </>
              );

              return (
                <Pressable
                  key={station.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar ${station.name}, ${station.address}`}
                  onPress={() => handleStationPress(station)}
                  style={({ pressed }) => [
                    s.card,
                    themeStyles.card,
                    pressed && s.pressed,
                  ]}
                >
                  {content}
                </Pressable>
              );
            })}

            {stationList.length === 0 && (
              <View style={[s.card, themeStyles.card]}>
                <Text style={[s.emptyTitle, themeStyles.titleText]}>
                  Nenhuma unidade encontrada
                </Text>
                <Text style={[s.description, themeStyles.mutedText]}>
                  Tente selecionar outro endereço de referência.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Barra Inferior Persistente com Botão de Emergência (RF14) */}
      <BottomNavigation
        activeTab="delegacias"
        onTabPress={(tab) => {
          if (tab === 'delegacias') return;
          router.replace(
            tab === 'telefones'
              ? '/telefones'
              : tab === 'orientacoes'
                ? '/orientacoes'
                : '/',
          );
        }}
        onPanicPress={() => router.push('/emergency')}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#7450A5' },
  scroll: { flexGrow: 1 },
  header: {
    width: '100%', maxWidth: 600, alignSelf: 'center',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30,
  },
  navigation: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 26, gap: 16,
  },
  eyebrow: {
    flexShrink: 1, color: '#EDE4F7', fontSize: 11,
    fontWeight: '700', letterSpacing: 1.5,
  },
  close: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  closeText: { color: '#FFFFFF', fontSize: 30, lineHeight: 34 },
  title: {
    color: '#FFFFFF', fontSize: 32,
    fontWeight: '700', letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 10, color: '#EDE4F7',
    fontSize: 16, lineHeight: 24, maxWidth: 360,
  },
  body: {
    flexGrow: 1, padding: 20, paddingTop: 24, paddingBottom: 32,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    backgroundColor: '#F7F5FB',
  },
  content: {
    width: '100%', maxWidth: 552, alignSelf: 'center', gap: 14,
  },
  mapCard: {
    padding: 8, borderRadius: 24, borderWidth: 1,
    borderColor: '#E9E2F0', backgroundColor: '#FFFFFF',
  },
  address: {
    minHeight: 68, flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  addressContent: { flex: 1 },
  fieldLabel: {
    color: '#71687D', fontSize: 10, fontWeight: '700', letterSpacing: 1,
  },
  addressValue: {
    marginTop: 6, color: '#30243F',
    fontSize: 15, lineHeight: 22, fontWeight: '600',
  },
  arrow: { color: '#7450A5', fontSize: 24 },
  mapContainer: {
    height: 260, overflow: 'hidden',
    borderRadius: 18, backgroundColor: '#F0EBF7',
  },
  placeholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, borderRadius: 18, borderWidth: 1,
    borderStyle: 'dashed', borderColor: '#CDBCE2',
  },
  pin: {
    width: 34, height: 34, marginBottom: 22,
    borderRadius: 17, borderBottomRightRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7450A5', transform: [{ rotate: '45deg' }],
  },
  pinCenter: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF',
  },
  mapTitle: {
    color: '#503273', fontSize: 17, fontWeight: '700', textAlign: 'center',
  },
  mapDescription: {
    marginTop: 8, color: '#71687D',
    fontSize: 13, lineHeight: 20, textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginTop: 12, paddingHorizontal: 4,
  },
  sectionTitle: { color: '#30243F', fontSize: 19, fontWeight: '700' },
  countBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: '#EEE7F6',
  },
  countText: { color: '#503273', fontSize: 12, fontWeight: '700' },
  card: {
    padding: 20, borderRadius: 22, borderWidth: 1,
    borderColor: '#E9E2F0', backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  cardTitle: {
    flex: 1, color: '#30243F', fontSize: 17,
    lineHeight: 24, fontWeight: '700',
  },
  description: {
    marginTop: 10, color: '#71687D', fontSize: 14, lineHeight: 22,
  },
  distanceBadge: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: '#F3EFF8',
  },
  distanceText: { color: '#503273', fontSize: 12, fontWeight: '700' },
  specializedBadge: {
    alignSelf: 'flex-start', marginTop: 14,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#EEE7F6',
  },
  specializedText: { color: '#503273', fontSize: 11, fontWeight: '600' },
  emptyTitle: { color: '#30243F', fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});