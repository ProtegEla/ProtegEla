import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { Schemas } from "./contracts";

export const reportsService = {
  async getReportDetails(
    reportId: string
  ): Promise<Schemas["ReportDetailData"]> {
    const response = await apiClient.get<Schemas["ReportDetailResponse"]>(
      ENDPOINTS.REPORTS.BY_ID(reportId)
    );
    return response.data.data;
  },

  async createReport(
    payload: Schemas["ReportCreate"]
  ): Promise<Schemas["ReportRead"]> {
    const response = await apiClient.post<Schemas["ReportCreated"]>(
      ENDPOINTS.REPORTS.BASE,
      payload
    );
    return response.data.data;
  },

  async confirmReport(reportId: string): Promise<Schemas["ConfirmationData"]> {
    const response = await apiClient.post<Schemas["ReportConfirmed"]>(
      ENDPOINTS.REPORTS.CONFIRM(reportId),
      {}
    );
    return response.data.data;
  },

  async reportAbuse(reportId: string): Promise<{ report_id: string }> {
    const response = await apiClient.post<{ data: { report_id: string } }>(
      ENDPOINTS.REPORTS.REPORT_ABUSE(reportId),
      {}
    );
    return response.data.data;
  },

  async listComments(
    reportId: string,
    page = 1,
    pageSize = 50
  ): Promise<Schemas["CommentRead"][]> {
    const response = await apiClient.get<Schemas["CommentPage"]>(
      ENDPOINTS.REPORTS.COMMENTS(reportId),
      { params: { page, page_size: pageSize } }
    );
    return response.data?.data ?? [];
  },

  async addComment(
    reportId: string,
    payload: Schemas["CommentCreate"]
  ): Promise<Schemas["CommentRead"]> {
    const response = await apiClient.post<Schemas["CommentResponse"]>(
      ENDPOINTS.REPORTS.COMMENTS(reportId),
      payload
    );
    return response.data.data;
  },
};
