import { useEffect, useRef, useState } from "react";

import {
  ApiError,
  normalizeApiError,
} from "../../services/api/client";

import {
  commentsService,
  reportsService,
} from "../../services/api/reports";

import {
  adaptComment,
  adaptReport,
  buildReportPayload,
  type Comment,
  type Coordinates,
  type Detail,
  type ReportFormData,
} from "../../services/api/reportAdapters";

type Options = {
  currentCoords: Coordinates;
  hasUserLocation: boolean;
  authorName?: string;
  identityKey?: string | null;
};

const mergeComments = (
  previous: Comment[],
  incoming: Comment[],
) =>
  [
    ...new Map(
      [...previous, ...incoming].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

export function useHomeReports({
  currentCoords,
  hasUserLocation,
  identityKey = null,
}: Options) {
  const [reports, setReports] = useState<Detail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates | null>(null);

  const [mapCenter, setMapCenter] = useState(currentCoords);
  const [cameraRevision, setCameraRevision] = useState(0);

  const [creationSession, setCreationSession] = useState<{
    id: string;
    location: Coordinates;
    address: string;
  } | null>(null);

  const [notice, setNotice] = useState(
    "Selecione o local do incidente no mapa.",
  );

  const [error, setError] = useState("");
  const [commentsError, setCommentsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [revision, setRevision] = useState(0);

  const generation = useRef(0);
  const identityEpoch = useRef(0);
  const pageRef = useRef(1);
  const selectedRef = useRef<string | null>(null);

  const confirmed = useRef(new Set<string>());
  const abused = useRef(new Set<string>());
  const ownComments = useRef(new Set<string>());

  const confirmBusy = useRef(new Set<string>());
  const abuseBusy = useRef(new Set<string>());
  const moreBusy = useRef(false);

  const operationSequence = useRef(0);
  const commentOperation = useRef<number | null>(null);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  useEffect(() => {
    identityEpoch.current += 1;

    confirmed.current.clear();
    abused.current.clear();
    ownComments.current.clear();
    commentOperation.current = null;

    closeDetails();
    setCreationSession(null);

    setReports((previous) =>
      previous.map((report) => ({
        ...report,
        confirmedByMe: false,
        abuseRegistered: false,
        comments: report.comments.map((comment) => ({
          ...comment,
          isMine: false,
        })),
      })),
    );
  }, [identityKey]);

  useEffect(() => {
    setMapCenter({ ...currentCoords });
  }, [currentCoords.latitude, currentCoords.longitude]);

  function upsert(report: Detail) {
    setReports((previous) => {
      const next = {
        ...report,
        confirmedByMe: confirmed.current.has(report.id),
        abuseRegistered: abused.current.has(report.id),
      };

      if (!previous.some((item) => item.id === report.id)) {
        return [...previous, next];
      }

      return previous.map((item) =>
        item.id === report.id
          ? {
              ...next,
              comments: mergeComments(
                item.comments,
                next.comments,
              ),
            }
          : item,
      );
    });
  }

  function closeDetails() {
    generation.current += 1;
    selectedRef.current = null;
    moreBusy.current = false;

    setSelectedId(null);
    setLoading(false);
    setLoadingMore(false);
  }

  async function selectReportById(id: string) {
    const request = ++generation.current;
    const knownOwnComments = new Set(ownComments.current);

    selectedRef.current = id;
    pageRef.current = 1;

    setSelectedId(id);
    setLoading(true);
    setError("");
    setCommentsError("");
    setHasMoreComments(false);

    try {
      const detail = await reportsService.get(id);

      if (request !== generation.current) return;

      upsert(adaptReport(detail));

      try {
        const page = await commentsService.list(id);

        if (request !== generation.current) return;

        setReports((previous) =>
          previous.map((item) =>
            item.id === id
              ? {
                  ...item,
                  comments: mergeComments(
                    item.comments.filter(
                      (comment) =>
                        ownComments.current.has(comment.id) &&
                        !knownOwnComments.has(comment.id),
                    ),
                    page.data.map((value) =>
                      adaptComment(
                        value,
                        ownComments.current.has(value.id),
                      ),
                    ),
                  ),
                }
              : item,
          ),
        );

        setHasMoreComments(
          page.meta.page * page.meta.page_size <
            page.meta.total_records,
        );
      } catch (failure) {
        if (request === generation.current) {
          setCommentsError(
            normalizeApiError(failure).message,
          );
        }
      }
    } catch (failure) {
      if (request !== generation.current) return;

      const problem = normalizeApiError(failure);
      setError(problem.message);

      if (problem.status === 404) {
        setReports((previous) =>
          previous.filter((item) => item.id !== id),
        );

        closeDetails();
        setRevision((value) => value + 1);
      }
    } finally {
      if (request === generation.current) {
        setLoading(false);
      }
    }
  }

  async function loadMoreComments() {
    const id = selectedRef.current;

    if (!id || moreBusy.current || !hasMoreComments) return;

    moreBusy.current = true;
    const request = generation.current;
    setLoadingMore(true);

    try {
      const page = await commentsService.list(
        id,
        pageRef.current + 1,
      );

      if (request !== generation.current) return;

      pageRef.current = page.meta.page;

      setReports((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                comments: mergeComments(
                  item.comments,
                  page.data.map((value) =>
                    adaptComment(
                      value,
                      ownComments.current.has(value.id),
                    ),
                  ),
                ),
              }
            : item,
        ),
      );

      setHasMoreComments(
        page.meta.page * page.meta.page_size <
          page.meta.total_records,
      );

      setCommentsError("");
    } catch (failure) {
      if (request === generation.current) {
        setCommentsError(
          normalizeApiError(failure).message,
        );
      }
    } finally {
      if (request === generation.current) {
        moreBusy.current = false;
        setLoadingMore(false);
      }
    }
  }

  function selectLocation(coordinates: Coordinates) {
    setSelectedLocation({ ...coordinates });

    setNotice(
      `Local selecionado: ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
    );
  }

  function openCreateReport() {
    const location = {
      ...(selectedLocation ?? currentCoords),
    };

    setCreationSession({
      id: `draft-${Date.now()}`,
      location,
      address:
        `${
          selectedLocation
            ? "Local selecionado"
            : hasUserLocation
              ? "Sua localização"
              : "Centro inicial do mapa"
        } · ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
    });
  }

  async function createReport(form: ReportFormData) {
    const epoch = identityEpoch.current;

    const created = await reportsService.create(
      buildReportPayload(form),
    );

    if (epoch !== identityEpoch.current) return;

    upsert(adaptReport(created));

    setMapCenter({ ...created.location });
    setSelectedLocation({ ...created.location });

    setCameraRevision((value) => value + 1);
    setRevision((value) => value + 1);
    setNotice("Relato publicado.");

    // Publicação já foi concluída. Falha nesta leitura não deve
    // provocar uma nova tentativa de POST.
    void reportsService
      .get(created.id)
      .then((value) => {
        if (epoch === identityEpoch.current) {
          upsert(adaptReport(value));
        }
      })
      .catch(() => {});
  }

  async function confirmReport(id: string) {
    const epoch = identityEpoch.current;
    const key = `${epoch}:${id}`;

    if (
      confirmed.current.has(id) ||
      confirmBusy.current.has(key)
    ) {
      return;
    }

    confirmBusy.current.add(key);

    try {
      await reportsService.confirm(id);

      if (epoch !== identityEpoch.current) return;

      confirmed.current.add(id);

      setReports((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, confirmedByMe: true }
            : item,
        ),
      );

      setRevision((value) => value + 1);

      try {
        const detail = await reportsService.get(id);

        if (epoch === identityEpoch.current) {
          upsert(adaptReport(detail));
        }
      } catch {
        if (epoch === identityEpoch.current) {
          setError(
            "Confirmação registrada. Não foi possível atualizar a contagem agora.",
          );
        }
      }
    } finally {
      confirmBusy.current.delete(key);
    }
  }

  async function reportAbuse(id: string) {
    const epoch = identityEpoch.current;
    const key = `${epoch}:${id}`;

    if (
      abused.current.has(id) ||
      abuseBusy.current.has(key)
    ) {
      return;
    }

    abuseBusy.current.add(key);

    try {
      await reportsService.reportAbuse(id);

      if (epoch !== identityEpoch.current) return;

      abused.current.add(id);
      setRevision((value) => value + 1);

      setReports((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, abuseRegistered: true }
            : item,
        ),
      );

      try {
        const detail = await reportsService.get(id);

        if (epoch === identityEpoch.current) {
          upsert(adaptReport(detail));
        }
      } catch (failure) {
        if (epoch !== identityEpoch.current) return;

        if (
          failure instanceof ApiError &&
          failure.status === 404
        ) {
          setReports((previous) =>
            previous.filter((item) => item.id !== id),
          );

          closeDetails();
        } else {
          setError(
            "Denúncia registrada. Não foi possível atualizar o relato agora.",
          );
        }
      }
    } finally {
      abuseBusy.current.delete(key);
    }
  }

  async function addComment(
    id: string,
    text: string,
    parentId?: string,
  ) {
    if (commentOperation.current !== null) {
      throw new Error(
        "Aguarde o envio do comentário anterior.",
      );
    }

    if (!text.trim() || text.trim().length > 1000) {
      throw new Error(
        "Use entre 1 e 1.000 caracteres.",
      );
    }

    const epoch = identityEpoch.current;
    const operation = ++operationSequence.current;

    commentOperation.current = operation;

    try {
      const value = await commentsService.create(
        id,
        text,
        parentId,
      );

      if (epoch !== identityEpoch.current) return;

      ownComments.current.add(value.id);
      const comment = adaptComment(value, true);

      setReports((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                comments: mergeComments(
                  item.comments,
                  [comment],
                ),
              }
            : item,
        ),
      );
    } finally {
      if (commentOperation.current === operation) {
        commentOperation.current = null;
      }
    }
  }

  return {
    reports,
    selectedReport:
      reports.find((item) => item.id === selectedId) ?? null,

    selectedLocation,
    mapCenter,
    cameraRevision,
    creationSession,
    notice,

    loading,
    error,
    commentsError,
    hasMoreComments,
    loadingMore,
    revision,

    selectReport: (report: Pick<Detail, "id">) => {
      void selectReportById(report.id);
    },

    selectReportById,
    closeDetails,
    selectLocation,
    openCreateReport,
    createReport,

    closeCreateReport: () => setCreationSession(null),

    confirmReport,

    // Compatibilidade temporária com o nome usado no index.
    // Não desfaz: confirma pela API.
    toggleConfirmation: confirmReport,

    reportAbuse,
    addComment,
    loadMoreComments,

    recenterMap: () => {
      setMapCenter({ ...currentCoords });
      setCameraRevision((value) => value + 1);
    },

    clearError: () => setError(""),
  };
}