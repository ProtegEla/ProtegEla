/**
 * Mapeamento centralizado de endpoints da API ProtegEla v1.
 * Mantido em estrita conformidade com docs/api_contracts.md.
 */
export const ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: "/auth/register",
    LOGIN: "/auth/login",
    REFRESH: "/auth/refresh",
    FORGOT_PASSWORD: "/auth/forgot-password",
  },
  // Usuárias
  USERS: {
    ME: "/users/me",
  },
  // Relatos
  REPORTS: {
    BASE: "/reports",
    CONFIRM: (id: string) => `/reports/${id}/confirm`,
    REPORT_ABUSE: (id: string) => `/reports/${id}/report-abuse`,
    COMMENTS: (id: string) => `/reports/${id}/comments`,
  },
  // Zonas de Risco
  RISK_ZONES: {
    BASE: "/risk-zones",
  },
  // Rotas
  ROUTES: {
    CALCULATE: "/routes/calculate",
  },
  // Emergência e Pânico
  EMERGENCY: {
    PANIC: "/emergency/panic",
    USEFUL_NUMBERS: "/emergency/useful-numbers",
  },
  // Locais de Apoio
  SUPPORT_LOCATIONS: {
    NEARBY: "/support-locations/nearby",
  },
  // Notificações
  NOTIFICATIONS: {
    PROXIMITY_ALERT: "/notifications/proximity-alert",
  },
  // Healthcheck
  HEALTH: "/health",
};
