import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import { secureStore } from "../../storage/secureStore";

export interface EmergencyContactItem {
  id?: string;
  name: string;
  phone: string;
  is_primary: boolean;
}

const LOCAL_CONTACTS_KEY = "@protegela/emergency_contacts";

export const usersService = {
  async getEmergencyContacts(): Promise<EmergencyContactItem[]> {
    const token = await secureStore.getAccessToken();
    if (!token) {
      return this.getLocalEmergencyContacts();
    }

    const response = await apiClient.get<{ data: EmergencyContactItem[] }>(
      ENDPOINTS.USERS.EMERGENCY_CONTACTS
    );
    const items = response.data?.data ?? [];
    await this.saveLocalEmergencyContacts(items);
    return items;
  },

  async updateEmergencyContacts(
    contacts: EmergencyContactItem[]
  ): Promise<EmergencyContactItem[]> {
    await this.saveLocalEmergencyContacts(contacts);
    const token = await secureStore.getAccessToken();
    if (!token) {
      return contacts;
    }

    const response = await apiClient.put<{ data: EmergencyContactItem[] }>(
      ENDPOINTS.USERS.EMERGENCY_CONTACTS,
      { contacts }
    );
    const saved = response.data?.data ?? contacts;
    await this.saveLocalEmergencyContacts(saved);
    return saved;
  },

  async getLocalEmergencyContacts(): Promise<EmergencyContactItem[]> {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_CONTACTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async saveLocalEmergencyContacts(
    contacts: EmergencyContactItem[]
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(contacts));
    } catch {
      // Ignora erro de persistência local
    }
  },

  async getPrimaryEmergencyContact(): Promise<{
    name: string;
    phone: string;
  }> {
    const fallbackPhone =
      process.env.EXPO_PUBLIC_EMERGENCY_PHONE || "190";
    const fallback = {
      name:
        fallbackPhone === "190"
          ? "Polícia Militar (190)"
          : "Contato de emergência",
      phone: fallbackPhone,
    };

    try {
      const contacts = await this.getEmergencyContacts();
      const primary =
        contacts.find((c) => c.is_primary && c.phone.trim()) ||
        contacts.find((c) => c.phone.trim());
      if (primary) {
        return {
          name: primary.name.trim() || "Contato de emergência",
          phone: primary.phone.trim(),
        };
      }
    } catch {
      const local = await this.getLocalEmergencyContacts();
      const primary =
        local.find((c) => c.is_primary && c.phone.trim()) ||
        local.find((c) => c.phone.trim());
      if (primary) {
        return {
          name: primary.name.trim() || "Contato de emergência",
          phone: primary.phone.trim(),
        };
      }
    }

    return fallback;
  },
};
