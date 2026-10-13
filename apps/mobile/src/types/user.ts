/**
 * Tipos de usuária e contatos de emergência (RF01, RF17).
 */

export interface EmergencyContact {
  id: string;
  name: string;
  phone_number: string;
  is_primary: boolean; // 1 contato principal e até 2 secundários (RF01)
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  proximity_alerts_enabled: boolean;
  sound_alerts_enabled: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  created_at: string;
  emergency_contacts: EmergencyContact[];
  preferences: UserPreferences;
}
