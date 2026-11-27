import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/ui/BottomNavigation';
import { useAppTheme } from '../src/theme';

type Props = {
  onClose?: () => void;
};

const PHONES = [
  {
    number: '180',
    name: 'Central de Atendimento à Mulher',
    description: 'Orientação e denúncias de violência contra a mulher.',
    emergency: false,
  },
  {
    number: '181',
    name: 'Disque-Denúncia',
    description:
      'Denúncias anônimas de crimes. A disponibilidade varia conforme o estado.',
    emergency: false,
  },
  {
    number: '190',
    name: 'Polícia Militar',
    description: 'Emergências policiais e situações de risco imediato.',
    emergency: true,
  },
  {
    number: '192',
    name: 'SAMU',
    description: 'Atendimento em urgências e emergências médicas.',
    emergency: true,
  },
  {
    number: '188',
    name: 'CVV',
    description: 'Escuta e apoio emocional para prevenção do suicídio, 24 horas.',
    emergency: false,
  },
];

export default function UsefulPhonesScreen({ onClose }: Props) {
  const { colors, isDark } = useAppTheme();

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      router.replace('/');
    }
  }

  async function openDialer(number: string) {
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      Alert.alert(
        'Não foi possível abrir o telefone',
        `Disque ${number} manualmente pelo telefone.`,
      );
    }
  }

  const themeStyles = {
    screen: { backgroundColor: isDark ? '#2A1B46' : '#7450A5' },
    body: { backgroundColor: isDark ? colors.screenBackground : '#F7F5FB' },
    hint: { color: isDark ? colors.textMuted : '#71687D' },
    card: {
      backgroundColor: isDark ? colors.cardBackground : '#FFFFFF',
      borderColor: isDark ? colors.border : '#E9E2F0',
    },
    emergencyCard: {
      backgroundColor: isDark ? '#2B151D' : '#FFFAFB',
      borderColor: isDark ? '#5C2230' : '#EFD8DF',
    },
    cardTitle: { color: isDark ? colors.text : '#30243F' },
    description: { color: isDark ? colors.textMuted : '#71687D' },
    numberBadge: { backgroundColor: isDark ? colors.primaryLight : '#EEE7F6' },
    number: { color: isDark ? colors.primaryDark : '#503273' },
    redBadge: { backgroundColor: isDark ? '#4C1D24' : '#F8E4EA' },
    redText: { color: isDark ? '#FCA5A5' : '#A53853' },
    footer: { borderTopColor: isDark ? colors.border : '#E9E2F0' },
    accentText: { color: isDark ? colors.primaryDark : '#503273' },
  };

  return (
    <SafeAreaView style={[s.screen, themeStyles.screen]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View style={s.navigation}>
            <Text style={s.eyebrow}>REDE DE APOIO</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar telefones úteis"
              onPress={handleClose}
              style={({ pressed }) => [s.close, pressed && s.pressed]}
            >
              <Text style={s.closeText}>X</Text>
            </Pressable>
          </View>

          <Text accessibilityRole="header" style={s.title}>
            Telefones úteis
          </Text>
          <Text style={s.subtitle}>
            Encontre o atendimento certo para o que você precisa.
          </Text>
        </View>

        <View style={[s.body, themeStyles.body]}>
          <View style={s.content}>
            <Text style={[s.hint, themeStyles.hint]}>
              Toque em um cartão para abrir o discador.
            </Text>

            {PHONES.map(phone => (
              <Pressable
                key={phone.number}
                accessibilityRole="button"
                accessibilityLabel={`Abrir discador para ligar ${phone.number}, ${phone.name}`}
                onPress={() => openDialer(phone.number)}
                style={({ pressed }) => [
                  s.card,
                  themeStyles.card,
                  phone.emergency && [s.emergencyCard, themeStyles.emergencyCard],
                  pressed && s.pressed,
                ]}
              >
                <View style={s.row}>
                  <Text style={[s.cardTitle, themeStyles.cardTitle]}>{phone.name}</Text>
                  <View style={[s.numberBadge, themeStyles.numberBadge, phone.emergency && [s.redBadge, themeStyles.redBadge]]}>
                    <Text style={[s.number, themeStyles.number, phone.emergency && themeStyles.redText]}>
                      {phone.number}
                    </Text>
                  </View>
                </View>

                <Text style={[s.description, themeStyles.description]}>{phone.description}</Text>

                <View style={[s.footer, themeStyles.footer]}>
                  <Text style={[s.category, themeStyles.accentText, phone.emergency && themeStyles.redText]}>
                    {phone.emergency ? 'Emergência' : 'Orientação e apoio'}
                  </Text>
                  <Text style={[s.link, themeStyles.accentText]}>Ligar ↗</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Barra Inferior Persistente com Botão de Emergência (RF14) */}
      <BottomNavigation
        activeTab="telefones"
        onTabPress={(tab) => {
          if (tab === 'telefones') return;
          router.replace(
            tab === 'delegacias'
              ? '/delegacias'
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
  hint: { color: '#71687D', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  card: {
    padding: 20, borderRadius: 22, borderWidth: 1,
    borderColor: '#E9E2F0', backgroundColor: '#FFFFFF',
  },
  emergencyCard: { backgroundColor: '#FFFAFB', borderColor: '#EFD8DF' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  cardTitle: {
    flex: 1, color: '#30243F', fontSize: 17,
    lineHeight: 24, fontWeight: '700',
  },
  numberBadge: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, backgroundColor: '#EEE7F6',
  },
  number: {
    color: '#503273', fontSize: 23,
    fontWeight: '800', fontVariant: ['tabular-nums'],
  },
  redBadge: { backgroundColor: '#F8E4EA' },
  redText: { color: '#A53853' },
  description: {
    marginTop: 10, color: '#71687D', fontSize: 14, lineHeight: 22,
  },
  footer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    justifyContent: 'space-between', alignItems: 'center',
    marginTop: 18, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E9E2F0',
  },
  category: { color: '#503273', fontSize: 12, fontWeight: '600' },
  link: { color: '#503273', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});