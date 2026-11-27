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
    RESET_PASSWORD: "/auth/reset-password",
    CHANGE_PASSWORD: "/auth/change-password",
  },
  // Usuárias
  USERS: {
    ME: "/users/me",
    EMERGENCY_CONTACTS: "/users/me/emergency-contacts",
  },
  // Relatos
  REPORTS: {
    BASE: "/reports",
    BY_ID: (id: string) => `/reports/${id}`,
    CONFIRM: (id: string) => `/reports/${id}/confirm`,
    REPORT_ABUSE: (id: string) => `/reports/${id}/report-abuse`,
    COMMENTS: (id: string) => `/reports/${id}/comments`,
  },
  // Zonas de Risco
  RISK_ZONES: {
    BASE: "/risk-zones",
    INCIDENTS: (id: string) => `/risk-zones/${id}/incidents`,
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
  // Endereços e Geocodificação
  ADDRESSES: {
    SUGGESTIONS: "/addresses/suggestions",
  },
  // Notificações
  NOTIFICATIONS: {
    PROXIMITY_ALERT: "/notifications/proximity-alert",
  },
  // Healthcheck
  HEALTH: "/health",
};
