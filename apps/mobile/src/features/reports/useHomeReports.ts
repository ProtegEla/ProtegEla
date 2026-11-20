import { useRef, useState } from "react";

import type { Coordinates } from "../map/types";

import {
  coordinatesLabel,
  createDemoReports,
  isValidCoordinates,
  type CreateReportPayload,
  type DangerReport,
} from "./reportModel";

type CreationSession = {
  id: string;
  location: Coordinates;
  address: string;
};

type Options = {
  currentCoords: Coordinates;
  hasUserLocation: boolean;
  authorName?: string;
};

export function useHomeReports({
  currentCoords,
  hasUserLocation,
  authorName = "Você",
}: Options) {
  const [reports, setReports] = useState<DangerReport[]>([]);

  const [selectedId, setSelectedId] = useState<
    string | null
  >(null);

  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates | null>(null);

  const [creationSession, setCreationSession] =
    useState<CreationSession | null>(null);

  const [notice, setNotice] = useState(
    "Toque em uma área vazia do mapa para escolher o local de um relato.",
  );

  const sequence = useRef(0);

  function nextId() {
    sequence.current += 1;

    return `local-${Date.now()}-${sequence.current}`;
  }

  // Deriva da lista para refletir imediatamente alterações.
  const selectedReport =
    reports.find((report) => report.id === selectedId) ??
    null;

  function selectLocation(coordinates: Coordinates) {
    if (!isValidCoordinates(coordinates)) return;

    setSelectedLocation({ ...coordinates });

    setNotice(
      `Local selecionado: ${coordinatesLabel(coordinates)}`,
    );
  }

  function selectReport(report: DangerReport) {
    setSelectedId(report.id);
  }

  function closeDetails() {
    setSelectedId(null);
  }

  function openCreateReport() {
    const coordinates = selectedLocation ?? currentCoords;

    if (!isValidCoordinates(coordinates)) {
      setNotice(
        "Não foi possível identificar o local. Selecione um ponto no mapa.",
      );
      return;
    }

    const label = selectedLocation
      ? "Local selecionado"
      : hasUserLocation
        ? "Sua localização"
        : "Centro inicial do mapa";

    setSelectedId(null);

    // Captura o local ao abrir o formulário.
    // Atualizações do GPS não alteram este rascunho.
    setCreationSession({
      id: nextId(),
      location: { ...coordinates },
      address: `${label} · ${coordinatesLabel(coordinates)}`,
    });
  }

  function closeCreateReport() {
    setCreationSession(null);
  }

  function createReport(data: CreateReportPayload) {
    if (!creationSession) {
      throw new Error(
        "Selecione novamente o local do relato.",
      );
    }

    if (!isValidCoordinates(creationSession.location)) {
      throw new Error(
        "A localização selecionada não é válida.",
      );
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
      author: data.isAnonymous ? "Anônima" : authorName,

      createdAt: new Date().toISOString(),

      confirmations_count: 0,
      confirmedByMe: false,
      comments: [],
    };

    setReports((previous) => [...previous, report]);

    setNotice(
      "Relato adicionado ao mapa. Toque no marcador para abrir os detalhes.",
    );

    // O CreateReportBottomSheet fecha após o envio.
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
      author: authorName,
      text: normalized,
      createdAt: new Date().toISOString(),
      parentId,
    };

    setReports((previous) =>
      previous.map((report) => {
        if (report.id !== reportId) return report;

        // Respostas precisam apontar para um comentário
        // principal pertencente ao mesmo relato.
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

  function loadExamples() {
    const origin = selectedLocation ?? currentCoords;

    if (!isValidCoordinates(origin)) {
      setNotice(
        "Selecione um local válido para carregar os exemplos.",
      );
      return;
    }

    const examples = createDemoReports().map(
      (report, index): DangerReport => ({
        ...report,
        address: `Ponto de teste ${index + 1}`,
        location: {
          latitude: Math.max(
            -85,
            Math.min(
              85,
              origin.latitude +
                (index === 0 ? 0.0007 : -0.0007),
            ),
          ),
          longitude:
            ((((origin.longitude +
              (index === 0 ? -0.0007 : 0.0007)) +
              180) %
              360 +
              360) %
              360) -
            180,
        },
      }),
    );

    // Substitui apenas exemplos antigos.
    // Preserva os relatos que você criou.
    setReports((previous) => [
      ...previous.filter(
        (report) => !report.id.startsWith("demo-"),
      ),
      ...examples,
    ]);

    setNotice(
      "Dois relatos fictícios foram adicionados perto do local selecionado ou da sua localização.",
    );
  }

  return {
    reports,
    selectedReport,
    selectedLocation,
    creationSession,
    notice,

    selectLocation,
    selectReport,
    closeDetails,

    openCreateReport,
    closeCreateReport,
    createReport,

    toggleConfirmation,
    addComment,
    loadExamples,
  };
}