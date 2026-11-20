import React, { useRef, useState } from "react";

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { RiskMap } from "../map/components/RiskMap";
import type { Coordinates } from "../map/types";

import { CreateReportBottomSheet } from "./components/CreateReportBottomSheet";
import { DangerPointDetailsModal } from "./components/DangerPointDetailsModal";

import {
  coordinatesLabel,
  createDemoReports,
  DEMO_CENTER,
  getCategoryStyle,
  isValidCoordinates,
  type CreateReportPayload,
  type DangerReport,
} from "./reportModel";

type CreationSession = {
  id: string;
  location: Coordinates;
  address: string;
};

export function ReportsMapDemoScreen() {
  const [reports, setReports] =
    useState<DangerReport[]>(createDemoReports);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates | null>(null);

  const [creationSession, setCreationSession] =
    useState<CreationSession | null>(null);

  const [notice, setNotice] = useState(
    "Toque no mapa para selecionar o local do próximo relato.",
  );

  const sequence = useRef(0);

  function nextId() {
    sequence.current += 1;
    return `local-${Date.now()}-${sequence.current}`;
  }

  // Sempre deriva da lista atualizada.
  const selectedReport =
    reports.find((report) => report.id === selectedId) ??
    null;

  function openCreateReport() {
    if (!selectedLocation) {
      setNotice(
        "Primeiro, toque em uma área vazia do mapa para selecionar o local.",
      );
      return;
    }

    if (!isValidCoordinates(selectedLocation)) {
      setNotice("Selecione uma localização válida.");
      return;
    }

    // Snapshot: o local do rascunho não muda durante o preenchimento.
    setCreationSession({
      id: nextId(),
      location: { ...selectedLocation },
      address: `Local selecionado · ${coordinatesLabel(
        selectedLocation,
      )}`,
    });
  }

  function handleCreateReport(data: CreateReportPayload) {
    if (!creationSession) {
      throw new Error("Selecione novamente o local do relato.");
    }

    const description = data.description.trim();

    if (description.length < 10) {
      throw new Error(
        "Descreva o ocorrido com pelo menos 10 caracteres.",
      );
    }

    if (description.length > 1000) {
      throw new Error(
        "A descrição deve ter no máximo 1.000 caracteres.",
      );
    }

    const report: DangerReport = {
      id: nextId(),
      category: data.category,
      description,
      location: { ...creationSession.location },
      address: creationSession.address,
      addressDetail: data.addressDetail.trim(),
      period: data.period,
      isAnonymous: data.isAnonymous,
      author: data.isAnonymous ? "Anônima" : "Você",
      createdAt: new Date().toISOString(),
      confirmations_count: 0,
      confirmedByMe: false,
      comments: [],
    };

    setReports((previous) => [...previous, report]);

    setNotice(
      "Relato adicionado ao mapa. Toque no marcador para abrir os detalhes.",
    );

    // O formulário chama onClose após o envio bem-sucedido.
  }

  function toggleConfirmation(id: string) {
    setReports((previous) =>
      previous.map((report) => {
        if (report.id !== id) return report;

        return {
          ...report,
          confirmedByMe: !report.confirmedByMe,
          confirmations_count: Math.max(
            0,
            report.confirmations_count +
              (report.confirmedByMe ? -1 : 1),
          ),
        };
      }),
    );
  }

  function addComment(
    reportId: string,
    text: string,
    parentId?: string,
  ) {
    const normalized = text.trim();

    if (!normalized) return;

    const comment = {
      id: nextId(),
      author: "Você",
      text: normalized,
      createdAt: new Date().toISOString(),
      parentId,
    };

    setReports((previous) =>
      previous.map((report) => {
        if (report.id !== reportId) return report;

        if (
          parentId &&
          !report.comments.some(
            (item) =>
              item.id === parentId && !item.parentId,
          )
        ) {
          return report;
        }

        return {
          ...report,
          comments: [...report.comments, comment],
        };
      }),
    );
  }

  function resetDemo() {
    setReports(createDemoReports());
    setSelectedId(null);
    setSelectedLocation(null);
    setCreationSession(null);

    setNotice(
      "Exemplos restaurados. Toque no mapa para selecionar um local.",
    );
  }

  return (
    <SafeAreaView
      style={s.screen}
      edges={["top", "left", "right"]}
    >
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>PROTEGELA · TESTE</Text>
          <Text style={s.title}>Relatos no mapa</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restaurar relatos de exemplo"
          onPress={resetDemo}
          style={s.reset}
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color="#593582"
          />
        </Pressable>
      </View>

      <Text style={s.demoWarning}>
        Os relatos de exemplo são fictícios. As alterações
        ficam apenas nesta sessão.
      </Text>

      <View style={s.mapArea}>
        <RiskMap<DangerReport>
          center={DEMO_CENTER}
          zoom={15}
          mapStyle="streets"
          reports={reports}
          selectedLocation={selectedLocation}
          onMapPress={(coordinates) => {
            setSelectedLocation(coordinates);
            setNotice(
              `Local selecionado: ${coordinatesLabel(
                coordinates,
              )}`,
            );
          }}
          onSelectReport={(report) =>
            setSelectedId(report.id)
          }
        />

        <View
          pointerEvents="box-none"
          style={s.mapActions}
        >
          <View style={s.locationCard}>
            <Ionicons
              name="location-outline"
              size={20}
              color="#593582"
            />

            <Text
              accessibilityLiveRegion="polite"
              style={s.locationText}
            >
              {notice}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={openCreateReport}
            style={({ pressed }) => [
              s.addButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color="#FFFFFF"
            />
            <Text style={s.addButtonText}>
              Adicionar relato
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={s.listSection}>
        <Text style={s.listTitle}>
          Relatos disponíveis · {reports.length}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        >
          {reports.map((report) => {
            const category = getCategoryStyle(
              report.category,
            );

            return (
              <Pressable
                key={report.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir relato de ${report.category}`}
                onPress={() => setSelectedId(report.id)}
                style={s.reportCard}
              >
                <View
                  style={[
                    s.categoryBadge,
                    {
                      backgroundColor:
                        category.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.categoryText,
                      { color: category.color },
                    ]}
                  >
                    {report.category}
                  </Text>
                </View>

                <Text
                  numberOfLines={1}
                  style={s.reportAddress}
                >
                  {report.address}
                </Text>

                <Text style={s.reportMeta}>
                  {report.confirmations_count} confirmações
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {creationSession && (
        <CreateReportBottomSheet
          key={creationSession.id}
          visible
          currentAddress={creationSession.address}
          onClose={() => setCreationSession(null)}
          onSubmit={handleCreateReport}
        />
      )}

      <DangerPointDetailsModal
        report={selectedReport}
        onClose={() => setSelectedId(null)}
        onToggleConfirmation={toggleConfirmation}
        onAddComment={addComment}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F5FB",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  eyebrow: {
    color: "#8055B5",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 5,
    color: "#1E293B",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  reset: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EDE7F6",
    alignItems: "center",
    justifyContent: "center",
  },
  demoWarning: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  mapArea: {
    flex: 1,
    position: "relative",
    minHeight: 220,
  },
  mapActions: {
    position: "absolute",
    bottom: 22,
    left: 16,
    right: 16,
    zIndex: 10,
    gap: 10,
    maxWidth: 480,
    alignSelf: "center",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD5E8",
  },
  locationText: {
    flex: 1,
    color: "#593582",
    fontSize: 12,
    lineHeight: 18,
  },
  addButton: {
    minHeight: 52,
    backgroundColor: "#0F766E",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 14,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  listSection: {
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: "#F7F5FB",
  },
  listTitle: {
    marginHorizontal: 20,
    marginBottom: 10,
    color: "#1E293B",
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  reportCard: {
    width: 220,
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD5E8",
    gap: 8,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reportAddress: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "600",
  },
  reportMeta: {
    color: "#64748B",
    fontSize: 11,
  },
});