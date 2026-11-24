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
import { Ionicons } from '@expo/vector-icons';
import { BottomNavigation } from '../src/components/ui/BottomNavigation';

type Props = {
  onClose: () => void;
};

const GUIDANCE = [
  {
    id: 'respect',
    category: 'RESPEITO E LIMITES',
    title: 'O que é assédio?',
    description:
      'São comportamentos indesejados que constrangem, intimidam ou desrespeitam seus limites, como comentários, insistência ou contato sem consentimento.',
  },
  {
    id: 'theft',
    category: 'PRÓXIMOS PASSOS',
    title: 'Fui furtada. O que fazer?',
    description:
      'Registre um boletim de ocorrência. Em São Paulo, a Delegacia Eletrônica atende determinados casos online. Se levaram seus cartões, bloqueie-os e avise seu banco.',
  },
  {
    id: 'safety',
    category: 'SUA SEGURANÇA',
    title: 'Alguém está me seguindo',
    description:
      'Entre em um local movimentado e peça ajuda à equipe. Se houver risco imediato, ligue 190.',
  },
];

export default function GuidanceScreen({ onClose }: Props) {
  async function openPhone() {
    try {
      await Linking.openURL('tel:190');
    } catch {
      Alert.alert(
        'Não foi possível abrir o telefone',
        'Em caso de emergência, ligue 190 pelo telefone.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.navigation}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>GUIA DE APOIO</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar orientações"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <Text accessibilityRole="header" style={styles.title}>
            Orientações
          </Text>

          <Text style={styles.subtitle}>
            Informação e apoio para você saber como agir.
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.content}>
            <Text style={styles.sectionLabel}>
              Para consultar quando precisar
            </Text>

            <View style={styles.emergencyCard}>
              <Text accessibilityRole="header" style={styles.emergencyTitle}>
                Está em risco agora?
              </Text>

              <Text style={styles.emergencyDescription}>
                Em uma emergência, entre em contato com a Polícia Militar.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir discador para ligar 190"
                onPress={openPhone}
                style={({ pressed }) => [
                  styles.emergencyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emergencyButtonText}>
                  Ligar 190
                </Text>
                <Text style={styles.emergencyButtonHint}>
                  Abrir discador
                </Text>
              </Pressable>
            </View>

            {GUIDANCE.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryMark} />
                  <Text style={styles.category}>{item.category}</Text>
                </View>

                <Text accessibilityRole="header" style={styles.cardTitle}>
                  {item.title}
                </Text>

                <Text style={styles.description}>
                  {item.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Barra Inferior Persistente com Botão de Emergência (RF10, RF11, RF12, RF14) */}
      <BottomNavigation
        activeTab="orientacoes"
        onTabPress={(tab) => {
          if (tab === 'orientacoes') return;
          router.push(tab === 'delegacias' ? '/delegacias' : tab === 'telefones' ? '/telefones' : '/');
        }}
        onPanicPress={() => router.push('/emergency')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#7450A5',
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 28,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E6D8FA',
  },
  badgeText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '300',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: {
    maxWidth: 320,
    marginTop: 10,
    color: '#EDE4F7',
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 32,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#F6F4FA',
  },
  content: {
    width: '100%',
    maxWidth: 552,
    alignSelf: 'center',
    gap: 16,
  },
  sectionLabel: {
    marginBottom: 2,
    marginLeft: 4,
    color: '#70687C',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EAE4F1',
    backgroundColor: '#FFFFFF',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryMark: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#9977C4',
  },
  category: {
    flex: 1,
    color: '#7450A5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  cardTitle: {
    color: '#30243F',
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
  },
  description: {
    marginTop: 10,
    color: '#696171',
    fontSize: 15,
    lineHeight: 23,
  },
  emergencyCard: {
    marginTop: 4,
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#FCEEF1',
    borderWidth: 1,
    borderColor: '#F3DCE3',
  },
  emergencyTitle: {
    color: '#87364C',
    fontSize: 18,
    fontWeight: '700',
  },
  emergencyDescription: {
    marginTop: 8,
    color: '#805361',
    fontSize: 14,
    lineHeight: 21,
  },
  emergencyButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A53C58',
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  emergencyButtonHint: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});