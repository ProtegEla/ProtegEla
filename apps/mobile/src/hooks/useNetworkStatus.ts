import { useState, useEffect } from "react";

export interface NetworkStatus {
  isConnected: boolean;
  isOfflineMode: boolean;
}

/**
 * Hook para monitoramento de conectividade de rede (RNF03 - Resiliência Básica).
 * Notifica a aplicação se a conexão for perdida para acionar o uso do cache local.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    // Monitoramento padrão inicial (em versão completa integra @react-native-community/netinfo)
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    if (typeof window !== "undefined" && "addEventListener" in window) {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  return {
    isConnected,
    isOfflineMode: !isConnected,
  };
}
