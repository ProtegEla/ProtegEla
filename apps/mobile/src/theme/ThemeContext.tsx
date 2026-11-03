import React, { createContext, useContext, useState, ReactNode } from "react";
import { colors as lightColors } from "./colors";

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  screenBackground: string;
  inputBackground: string;
  primaryPurple: string;
  primaryAction: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  profileButtonBackground: string;
  profileDangerBackground: string;
  profileDangerText: string;
  profileTitlePurple: string;
  profileSubtitlePurple: string;
  bottomBarBackground: string;
  bottomBarBorder: string;
  cardBackground: string;
}

const darkColors: ThemeColors = {
  screenBackground: "#130E1E",
  inputBackground: "#241B38",
  primaryPurple: "#9D72D6",
  primaryAction: "#14B8A6",
  primary: "#9D72D6",
  primaryLight: "#2D1D4A",
  primaryDark: "#C4A5F3",
  secondary: "#14B8A6",
  background: "#130E1E",
  surface: "#1E1630",
  text: "#F8FAFC",
  textMuted: "#A397BC",
  border: "#3D2E5C",
  danger: "#F87171",
  warning: "#FBBF24",
  success: "#34D399",
  info: "#60A5FA",
  profileButtonBackground: "#241B38",
  profileDangerBackground: "#4C1D24",
  profileDangerText: "#FECDD3",
  profileTitlePurple: "#C4A5F3",
  profileSubtitlePurple: "#A397BC",
  bottomBarBackground: "#1A1329",
  bottomBarBorder: "#34264F",
  cardBackground: "#1E1630",
};

const lightThemeColors: ThemeColors = {
  ...lightColors,
  bottomBarBackground: "#EAE5F3",
  bottomBarBorder: "rgba(128, 85, 181, 0.15)",
  cardBackground: "#FFFFFF",
};

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "light",
  isDark: false,
  colors: lightThemeColors,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const isDark = themeMode === "dark";
  const colors = isDark ? darkColors : lightThemeColors;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);

