import { routesService } from "../routes";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

describe("routesService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("preserva a ordem das paradas e propaga falha sem inventar itinerário", async () => {
    const params = {
      origin: { latitude: -23.55, longitude: -46.63 },
      destination: { latitude: -23.57, longitude: -46.65 },
      stops: [
        { latitude: -23.56, longitude: -46.64 },
        { latitude: -23.565, longitude: -46.645 },
      ],
    };
    const failure = new Error("Serviço indisponível");
    (apiClient.post as jest.Mock).mockRejectedValueOnce(failure);
    await expect(routesService.calculateRoutes(params)).rejects.toBe(failure);
    expect(apiClient.post).toHaveBeenCalledWith("/routes/calculate", params);
  });

  it("mantém apenas uma candidata quando o provedor não oferece alternativas", async () => {
    const comparison = {
      fastest_route_id: "single", lower_risk_route_id: null,
      extra_duration_percent: null, exceeds_30_percent: null,
      status: "no_lower_risk_alternative",
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { data: {
      routes: [{ id: "single", geometry: { type: "LineString",
        coordinates: [[-46.63, -23.55], [-46.64, -23.56]] },
        distance_m: 100, duration_s: 30, legs: [],
        risk: { status: "evaluated", exposure_score: 1 } }],
      comparison, attribution: "OSM / ORS",
    } } });
    const result = await routesService.calculateRoutes({
      origin: { latitude: -23.55, longitude: -46.63 },
      destination: { latitude: -23.56, longitude: -46.64 },
    });
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].id).toBe("single");
    expect(result.routes[0].coordinates[0]).toEqual({ latitude: -23.55, longitude: -46.63 });
    expect(result.comparison).toEqual(comparison);
    expect(result.attribution).toBe("OSM / ORS");
    expect((apiClient.post as jest.Mock).mock.calls[0][1].stops).toEqual([]);
  });

  it("calcula rotas com sucesso e formata opções com tempo, distância e badges de risco", async () => {
    const mockResponse = {
      data: {
        data: {
          routes: [
            {
              id: "route-fastest",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-46.6333, -23.5505],
                  [-46.6400, -23.5550],
                ],
              },
              distance_m: 1900,
              duration_s: 1080, // 18 min
              legs: [],
              risk: {
                status: "evaluated",
                exposure_score: 20,
              },
            },
            {
              id: "route-safest",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-46.6333, -23.5505],
                  [-46.6420, -23.5570],
                ],
              },
              distance_m: 2600,
              duration_s: 1500, // 25 min
              legs: [],
              risk: {
                status: "evaluated",
                exposure_score: 5,
              },
            },
          ],
          comparison: {
            fastest_route_id: "route-fastest",
            lower_risk_route_id: "route-safest",
            extra_duration_percent: 38.8,
            exceeds_30_percent: true,
            status: "lower_risk_available",
          },
          attribution: "openrouteservice.org",
        },
      },
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await routesService.calculateRoutes({
      origin: { latitude: -23.5505, longitude: -46.6333 },
      destination: { latitude: -23.557, longitude: -46.642 },
    });

    expect(result.routes).toHaveLength(2);
    expect(result.comparison.fastest_route_id).toBe("route-fastest");
    expect(result.comparison.lower_risk_route_id).toBe("route-safest");

    const fastest = result.routes.find((r) => r.id === "route-fastest");
    expect(fastest).toBeDefined();
    expect(fastest?.durationLabel).toBe("18 min");
    expect(fastest?.distanceLabel).toBe("1,9 km");
    expect(fastest?.label).toBe("Mais rápida");

    const safest = result.routes.find((r) => r.id === "route-safest");
    expect(safest).toBeDefined();
    expect(safest?.durationLabel).toBe("25 min");
    expect(safest?.distanceLabel).toBe("2,6 km");
    expect(safest?.label).toBe("Mais segura");

    // Coordenadas convertidas para { latitude, longitude }
    expect(fastest?.coordinates[0]).toEqual({
      latitude: -23.5505,
      longitude: -46.6333,
    });
  });
});
