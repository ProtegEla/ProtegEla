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
