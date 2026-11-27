import { useEffect, useRef, useState } from "react";

import type { Coordinates } from "../map/types";
import type { Schemas } from "../../services/api/contracts";
import { reportsService } from "../../services/api/reports";
import { secureStore } from "../../storage/secureStore";

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

  const [mapCenter, setMapCenter] =
  useState<Coordinates>(currentCoords);

  const [cameraRevision, setCameraRevision] =
    useState(0);

  useEffect(() => {
    setMapCenter({
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
    });
  }, [
    currentCoords.latitude,
    currentCoords.longitude,
  ]);

  function recenterMap() {
    setSelectedLocation(null);
    setSelectedId(null);
    setMapCenter({ ...currentCoords });
    setCameraRevision((previous) => previous + 1);
  }

  function clearSelection() {
    setSelectedLocation(null);
    setSelectedId(null);
  }

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

    if (
      !report.id.startsWith("local-") &&
      !report.id.startsWith("demo-") &&
      !report.id.startsWith("ssp-")
    ) {
      void reportsService
        .listComments(report.id)
        .then((items) => {
          setReports((previous) =>
            previous.map((r) =>
              r.id === report.id
                ? {
                    ...r,
                    comments: items.map((c) => ({
                      id: c.id,
                      author: c.author || "Usuária",
                      text: c.text || "",
                      createdAt: c.created_at,
                      parentId: c.parent_id ?? undefined,
                    })),
                  }
                : r,
            ),
          );
        })
        .catch(() => {});
    }
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

  async function createReport(data: CreateReportPayload) {
    if (!creationSession) {
      throw new Error(
        "Abra novamente o formulário para publicar.",
      );
    }

    if (!isValidCoordinates(data.location)) {
      throw new Error(
        "Selecione uma localização válida no mapa.",
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

    const token = await secureStore.getAccessToken();
    if (!token) {
      throw new Error(
        "Faça login para publicar um relato na comunidade.",
      );
    }

    const location = { ...data.location };
    const addressRef =
      data.address.trim() ||
      `Local no mapa · ${coordinatesLabel(location)}`;
    const todayIso = new Date().toISOString().split("T")[0];
    const validPeriod: Schemas["IncidentPeriod"] =
      data.period === "manha" ||
      data.period === "tarde" ||
      data.period === "noite" ||
      data.period === "madrugada"
        ? data.period
        : "noite";

    const fullDescription = data.addressDetail.trim()
      ? `${description} (${data.addressDetail.trim()})`
      : description;

    const created = await reportsService.createReport({
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        address_reference: addressRef,
      },
      category: data.category as Schemas["ReportCategory"],
      description: fullDescription,
      incident_date: todayIso,
      incident_period: validPeriod,
      is_anonymous: data.isAnonymous,
    });

    const report: DangerReport = {
      id: created.id,
      source: "app",
      category: created.category,
      description: created.description || description,
      location,
      address: addressRef,
      addressDetail: data.addressDetail.trim(),
      period: created.incident_period,
      incidentDate: created.incident_date,
      isAnonymous: created.is_anonymous,
      author: created.is_anonymous ? "Anônima" : authorName,
      createdAt: created.created_at,
      confirmations_count: 0,
      confirmedByMe: false,
      comments: [],
    };

    setReports((previous) => [...previous, report]);

    setSelectedLocation(location);
    setMapCenter(location);
    setCameraRevision((previous) => previous + 1);

    setNotice(
      "Relato publicado com sucesso.",
    );
  }

  function extractInteractionError(error: unknown): string {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return "Você não pode confirmar ou denunciar o seu próprio relato.";
    }
    if (status === 401) {
      return "Faça login para confirmar ou denunciar relatos.";
    }
    if (status === 409) {
      return "Você já registrou outro tipo de interação neste relato.";
    }
    return "Não foi possível concluir a ação. Tente novamente.";
  }

  async function toggleConfirmation(id: string): Promise<string | void> {
    if (!id.startsWith("local-") && !id.startsWith("demo-")) {
      try {
        await reportsService.confirmReport(id);
      } catch (error) {
        const msg = extractInteractionError(error);
        setNotice(msg);
        return msg;
      }
    }

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

  async function reportAbuse(id: string): Promise<string | void> {
    if (!id.startsWith("local-") && !id.startsWith("demo-")) {
      try {
        await reportsService.reportAbuse(id);
      } catch (error) {
        const msg = extractInteractionError(error);
        setNotice(msg);
        return msg;
      }
    }
    const msg = "Denúncia registrada. Obrigada por ajudar a comunidade.";
    setNotice(msg);
    return msg;
  }

  async function addComment(
    reportId: string,
    text: string,
    parentId?: string,
  ) {
    const normalized = text.trim();

    if (!normalized) return;

    let commentId = nextId();
    let createdAt = new Date().toISOString();

    if (!reportId.startsWith("local-") && !reportId.startsWith("demo-")) {
      try {
        const created = await reportsService.addComment(reportId, {
          text: normalized,
          parent_id: parentId ?? null,
        });
        commentId = created.id;
        createdAt = created.created_at;
      } catch {
        return;
      }
    }

    const comment = {
      id: commentId,
      author: authorName,
      text: normalized,
      createdAt,
      parentId,
      isMine: true,
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
    clearSelection,
    selectReport,
    closeDetails,

    openCreateReport,
    closeCreateReport,
    createReport,

    toggleConfirmation,
    reportAbuse,
    addComment,
    loadExamples,

    mapCenter,
    cameraRevision,
    recenterMap,
  };
}