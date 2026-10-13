/**
 * Paleta de cores do ProtegEla.
 * Prioriza alto contraste para situações de estresse e emergência (RNF08).
 */
export const colors = {
  primary: "#6A1B9A", // Roxo principal
  primaryLight: "#F3E5F5",
  primaryDark: "#4A148C",
  secondary: "#00897B", // Verde azulado de apoio
  background: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#212121",
  textMuted: "#757575",
  border: "#E0E0E0",

  // Cores semânticas de risco e emergência
  danger: "#D32F2F", // Botão de pânico e risco extremo
  warning: "#F57C00", // Risco moderado / alerta
  success: "#388E3C", // Zonas seguras / delegacias
  info: "#1976D2", // Orientações e dicas

  // Níveis de Zonas de Risco (RN02)
  riskModerate: "#FFB74D",
  riskHigh: "#FF7043",
  riskExtreme: "#D32F2F",
};
