import type { Coordinates } from "../map/types";

import { isValidCoordinates } from "./reportModel";

export type AddressResult = {
  id: string;
  label: string;
  location: Coordinates;
};

export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressResult[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    limit: "5",
    countrycodes: "br",
    "accept-language": "pt-BR",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      signal,
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      "Não foi possível buscar o endereço. Tente novamente.",
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) return [];

  const results: AddressResult[] = [];

  for (const item of data) {
    if (!item || typeof item !== "object") continue;

    const row = item as Record<string, unknown>;

    const location = {
      latitude: Number(row.lat),
      longitude: Number(row.lon),
    };

    if (
      !isValidCoordinates(location) ||
      typeof row.display_name !== "string"
    ) {
      continue;
    }

    results.push({
      id: String(row.place_id),
      label: row.display_name,
      location,
    });
  }

  return results;
}