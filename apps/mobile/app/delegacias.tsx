import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/ui/BottomNavigation';

export type PoliceStation = {
  id: string;
  name: string;
  address: string;
  distanceLabel?: string;
  specialized?: boolean;
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
  addressLabel = 'Selecione um endereço',
  onSelectAddress,
  onSelectStation,
  mapContent,
}: Props) {
  // Garante que o valor usado em .length e .map seja um array.
  // Um array vazio recebido continua vazio.
  const stationList = Array.isArray(stations)
    ? stations
    : PLACEHOLDER_STATIONS;

  function handleClose() {
    if (onClose) {
      onClose();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <SafeAreaView style={s.screen}>
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

        <View style={s.body}>
          <View style={s.content}>
            <View style={s.mapCard}>
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
                  <Text style={s.fieldLabel}>
                    ENDEREÇO DE REFERÊNCIA
                  </Text>
                  <Text style={s.addressValue}>{addressLabel}</Text>
                </View>

                {onSelectAddress && (
                  <Text style={s.arrow}>⌄</Text>
                )}
              </Pressable>

              <View style={s.mapContainer}>
                {mapContent ?? (
                  <View style={s.placeholder}>
                    <View style={s.pin}>
                      <View style={s.pinCenter} />
                    </View>

                    <Text style={s.mapTitle}>Mapa da região</Text>
                    <Text style={s.mapDescription}>
                      Espaço reservado para o mapa.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={s.sectionHeader}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                Unidades
              </Text>

              <View style={s.countBadge}>
                <Text style={s.countText}>
                  {stationList.length}
                </Text>
              </View>
            </View>

            {stationList.map(station => {
              const content = (
                <>
                  <View style={s.row}>
                    <Text style={s.cardTitle}>{station.name}</Text>

                    {station.distanceLabel && (
                      <View style={s.distanceBadge}>
                        <Text style={s.distanceText}>
                          {station.distanceLabel}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={s.description}>{station.address}</Text>

                  {station.specialized && (
                    <View style={s.specializedBadge}>
                      <Text style={s.specializedText}>
                        Atendimento à mulher
                      </Text>
                    </View>
                  )}
                </>
              );

              return onSelectStation ? (
                <Pressable
                  key={station.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar ${station.name}, ${station.address}`}
                  onPress={() => onSelectStation(station)}
                  style={({ pressed }) => [
                    s.card,
                    pressed && s.pressed,
                  ]}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={station.id} style={s.card}>
                  {content}
                </View>
              );
            })}

            {stationList.length === 0 && (
              <View style={s.card}>
                <Text style={s.emptyTitle}>
                  Nenhuma unidade encontrada
                </Text>
                <Text style={s.description}>
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
          router.push(
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