import { supportLocationsService } from "../supportLocations";
import { apiClient } from "../client";
import { localStorage } from "../../../storage/localStorage";

jest.mock("../client", () => ({ apiClient: { get: jest.fn() } }));
jest.mock("../../../storage/localStorage", () => ({
  localStorage: {
    cacheSupportLocations: jest.fn(),
    getCachedSupportLocations: jest.fn(),
  },
}));

const params = { latitude: -23.55, longitude: -46.63 };
const cached = [{ id: "cached", name: "Delegacia visitada", type: "police",
  ...params, distance_meters: 0 }];

beforeEach(() => jest.resetAllMocks());

it("ordena locais pela distância atual e persiste apenas os resultados reais", async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [
    { id: "far", name: "Distante", latitude: -23.56, longitude: -46.63 },
    { id: "near", name: "Próxima", ...params },
  ] } });
  const result = await supportLocationsService.getNearby({ ...params, radius_meters: 1000 });
  expect(result.map((item) => item.id)).toEqual(["near", "far"]);
  expect(result[0].distance_meters).toBe(0);
  expect(result[1].distance_meters).toBeGreaterThan(1000);
  expect(apiClient.get).toHaveBeenCalledWith("/support-locations/nearby", {
    params: { ...params, radius: 1000 },
  });
  expect(localStorage.cacheSupportLocations).toHaveBeenCalledWith(result);
});

it.each([true, false])("recupera cache na falha de rede (com cache: %s)", async (hasCache) => {
  (apiClient.get as jest.Mock).mockRejectedValue(new Error("offline"));
  (localStorage.getCachedSupportLocations as jest.Mock).mockResolvedValue(hasCache ? cached : null);
  expect(await supportLocationsService.getNearby(params)).toEqual(hasCache ? cached : []);
  expect(localStorage.cacheSupportLocations).not.toHaveBeenCalled();
});

it("trata consulta vazia sem inventar locais de apoio", async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
  (localStorage.getCachedSupportLocations as jest.Mock).mockResolvedValue(null);
  expect(await supportLocationsService.getNearby(params)).toEqual([]);
  expect(localStorage.cacheSupportLocations).not.toHaveBeenCalled();
});
