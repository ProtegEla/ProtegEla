import { apiClient, requireAccessToken } from "./client";
import type { Schemas } from "./contracts";

type Options = {
  signal?: AbortSignal;
};

const encodeId = (id: string) => encodeURIComponent(id);

export const reportsService = {
  async get(id: string, options: Options = {}) {
    const response =
      await apiClient.get<Schemas["ReportDetailResponse"]>(
        `/reports/${encodeId(id)}`,
        options,
      );

    return response.data.data;
  },

  async create(payload: Schemas["ReportCreate"]) {
    await requireAccessToken();

    const response =
      await apiClient.post<Schemas["ReportCreated"]>(
        "/reports",
        payload,
      );

    return response.data.data;
  },

  async edit(
    id: string,
    payload: Schemas["ReportCreate"],
  ) {
    await requireAccessToken();

    const response =
      await apiClient.put<Schemas["ReportCreated"]>(
        `/reports/${encodeId(id)}`,
        payload,
      );

    return response.data.data;
  },

  async remove(id: string) {
    await requireAccessToken();
    await apiClient.delete(`/reports/${encodeId(id)}`);
  },

  async confirm(id: string) {
    await requireAccessToken();

    await apiClient.post(
      `/reports/${encodeId(id)}/confirm`,
      {},
    );
  },

  async reportAbuse(id: string) {
    await requireAccessToken();

    await apiClient.post(
      `/reports/${encodeId(id)}/report-abuse`,
      {},
    );
  },
};

export const commentsService = {
  async list(
    reportId: string,
    page = 1,
    options: Options = {},
  ) {
    const response =
      await apiClient.get<Schemas["CommentPage"]>(
        `/reports/${encodeId(reportId)}/comments`,
        {
          ...options,
          params: { page, page_size: 20 },
        },
      );

    return response.data;
  },

  async create(
    reportId: string,
    text: string,
    parentId?: string,
  ) {
    await requireAccessToken();

    const response =
      await apiClient.post<Schemas["CommentResponse"]>(
        `/reports/${encodeId(reportId)}/comments`,
        {
          text: text.trim(),
          ...(parentId ? { parent_id: parentId } : {}),
        } satisfies Schemas["CommentCreate"],
      );

    return response.data.data;
  },

  async edit(
    reportId: string,
    commentId: string,
    text: string,
  ) {
    await requireAccessToken();

    const response =
      await apiClient.patch<Schemas["CommentResponse"]>(
        `/reports/${encodeId(reportId)}/comments/${encodeId(commentId)}`,
        { text: text.trim() },
      );

    return response.data.data;
  },

  async remove(reportId: string, commentId: string) {
    await requireAccessToken();

    await apiClient.delete(
      `/reports/${encodeId(reportId)}/comments/${encodeId(commentId)}`,
    );
  },
};

export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export const riskZonesService = {
  async list(bounds: Bounds, options: Options = {}) {
    const { west, south, east, north } = bounds;

    if (
      ![west, south, east, north].every(Number.isFinite) ||
      west < -180 ||
      east > 180 ||
      south < -90 ||
      north > 90 ||
      west >= east ||
      south >= north
    ) {
      throw new Error("Área do mapa inválida.");
    }

    const response =
      await apiClient.get<Schemas["ZoneResponse"]>(
        "/risk-zones",
        {
          ...options,
          params: {
            bbox: [west, south, east, north].join(","),
          },
        },
      );

    return response.data;
  },

  async incidents(
    zoneId: string,
    page = 1,
    options: Options = {},
  ) {
    const response =
      await apiClient.get<Schemas["IncidentPage"]>(
        `/risk-zones/${encodeId(zoneId)}/incidents`,
        {
          ...options,
          params: { page, page_size: 20 },
        },
      );

    return response.data;
  },
};