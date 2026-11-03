import React, { createContext, useContext, useState, ReactNode } from "react";

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

  const login = (nickname = "Maria", email = "maria.lopez@gmail.com") => {
    setUser({ nickname, email });
    setIsLoggedIn(true);
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };

  const updateNickname = (newNickname: string) => {
    if (user) {
      setUser({ ...user, nickname: newNickname });
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

