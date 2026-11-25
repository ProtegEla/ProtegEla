import { apiClient } from "./client";
import type { Schemas } from "./contracts";

export type AddressSuggestion = Schemas["AddressSuggestion"];
export type SafetyGuide = Schemas["SafetyGuideRead"];
export type UsefulNumber = Schemas["UsefulNumber"];
export type SupportLocationWithDistance =
  Schemas["SupportLocationWithDistance"];

type Options = {
  signal?: AbortSignal;
};

export const emergencyService = {
  async getUsefulNumbers(options: Options = {}) {
    const response =
      await apiClient.get<Schemas["UsefulNumbersResponse"]>(
        "/emergency/useful-numbers",
        options,
      );

    return response.data.data;
  },

  async getCallTarget(options: Options = {}) {
    const response =
      await apiClient.get<Schemas["CallTargetResponse"]>(
        "/emergency/call-target",
        options,
      );

    return response.data.data;
  },
};

export const safetyGuidesService = {
  async list(options: Options = {}) {
    const response =
      await apiClient.get<Schemas["SafetyGuideList"]>(
        "/safety-guides",
        options,
      );

    return response.data.data;
  },

  async get(slug: string, options: Options = {}) {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
      throw new Error("Orientação inválida.");
    }

    const response =
      await apiClient.get<Schemas["SafetyGuideResponse"]>(
        `/safety-guides/${encodeURIComponent(slug)}`,
        options,
      );

    return response.data.data;
  },
};

export const supportLocationsService = {
  async getNearby(
    input: {
      latitude: number;
      longitude: number;
      radius_meters?: number;
    },
    options: Options = {},
  ) {
    const { latitude, longitude } = input;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new Error("Localização inválida.");
    }

    const response =
      await apiClient.get<Schemas["NearbySupportLocationsResponse"]>(
        "/support-locations/nearby",
        {
          params: { latitude, longitude },
          signal: options.signal,
          timeout: 12_000,
        },
      );

    return response.data.data;
  },
};

export const addressService = {
  async getSuggestions(
    query: string,
    limit = 5,
    options: Options = {},
  ) {
    const q = query.trim();

    if (q.length < 3 || q.length > 200) {
      throw new Error(
        "A busca deve ter entre 3 e 200 caracteres.",
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new Error("Limite de sugestões inválido.");
    }

    const response =
      await apiClient.get<Schemas["AddressSuggestionsResponse"]>(
        "/addresses/suggestions",
        {
          ...options,
          params: { q, limit },
        },
      );

    return response.data.data;
  },
};