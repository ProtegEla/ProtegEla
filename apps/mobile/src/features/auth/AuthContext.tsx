import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../../services/api/auth";
import { secureStore } from "../../storage/secureStore";

const USER_PROFILE_KEY = "@protegela/user_profile";

export interface User {
  nickname: string;
  email: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (nickname?: string, email?: string) => void;
  logout: () => void;
  updateNickname: (newNickname: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  login: () => {},
  logout: () => {},
  updateNickname: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await secureStore.getAccessToken();
        if (!token) return;
        const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
        if (raw) {
          setUser(JSON.parse(raw));
        } else {
          setUser({ nickname: "Usuária", email: "" });
        }
        setIsLoggedIn(true);
      } catch {
        // Ignora erro de leitura inicial
      }
    })();
  }, []);

  const login = (nickname = "Usuária", email = "") => {
    const profile = { nickname, email };
    setUser(profile);
    setIsLoggedIn(true);
    void AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    void authService.logout();
    void AsyncStorage.removeItem(USER_PROFILE_KEY);
  };

  const updateNickname = (newNickname: string) => {
    if (user) {
      const updated = { ...user, nickname: newNickname };
      setUser(updated);
      void AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        login,
        logout,
        updateNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
