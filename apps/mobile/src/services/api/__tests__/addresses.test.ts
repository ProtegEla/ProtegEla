import axios from "axios";
import { addressService } from "../addresses";
import { apiClient } from "../client";

jest.mock("axios");
jest.mock("../client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

describe("addressService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("retorna lista vazia quando a query tem menos de 3 caracteres", async () => {
    const results = await addressService.getSuggestions("ab");
    expect(results).toEqual([]);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("retorna sugestões da API do backend quando disponíveis", async () => {
    const mockSuggestions = [
      {
        id: "mock-1",
        label: "Avenida Paulista, São Paulo",
        latitude: -23.5615,
        longitude: -46.6559,
      },
    ];

    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { data: mockSuggestions },
    });

    const results = await addressService.getSuggestions("Paulista", 5);
    expect(results).toEqual(mockSuggestions);
    expect(apiClient.get).toHaveBeenCalledWith("/addresses/suggestions", {
      params: { q: "Paulista", limit: 5 },
    });
  });

  it("utiliza fallback via Nominatim quando backend retornar 503", async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("503 Service Unavailable"));
    (axios.get as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          place_id: 12345,
          display_name: "Russas, Ceará, Brasil",
          lat: "-4.8359",
          lon: "-38.2082",
        },
      ],
    });

    const results = await addressService.getSuggestions("Russas", 3);
    expect(results.length).toBe(1);
    expect(results[0].label).toContain("Russas");
    expect(results[0].latitude).toBeCloseTo(-4.8359);
  });
});
