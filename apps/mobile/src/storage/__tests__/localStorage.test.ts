import AsyncStorage from "@react-native-async-storage/async-storage";
import { localStorage } from "../localStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));

let items: Map<string, string>;
beforeEach(() => {
  jest.resetAllMocks();
  items = new Map();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => items.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { items.set(key, value); });
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key) => { items.delete(key); });
});

it("mantém rota, riscos e locais de apoio em caches independentes", async () => {
  const route = { id: "route" };
  const zones = [{ id: "risk" }];
  const locations = [{ id: "support" }];
  await localStorage.cacheLastRoute(route);
  await localStorage.cacheRiskZones(zones);
  await localStorage.cacheSupportLocations(locations);
  expect(await localStorage.getLastCachedRoute()).toEqual(route);
  expect(await localStorage.getCachedRiskZones()).toEqual(zones);
  expect(await localStorage.getCachedSupportLocations()).toEqual(locations);
});

it("trata dispositivo sem cache", async () => {
  expect(await localStorage.getLastCachedRoute()).toBeNull();
  expect(await localStorage.getCachedRiskZones()).toBeNull();
  expect(await localStorage.getCachedSupportLocations()).toBeNull();
});

it("limita pesquisas locais a dez e move seleção repetida para o início", async () => {
  for (let index = 0; index < 12; index++) {
    await localStorage.saveRecentSearch({
      id: String(index), label: `Local ${index}, São Paulo`,
      latitude: -23 - index * 0.01, longitude: -46,
    });
  }
  const recent = await localStorage.getRecentSearches();
  expect(recent).toHaveLength(10);
  expect(recent.map((item) => item.id)).toEqual(["11", "10", "9", "8", "7", "6", "5", "4", "3", "2"]);
  await localStorage.saveRecentSearch({
    id: "5", label: "Local atualizado, São Paulo", latitude: -23.05, longitude: -46,
  });
  const updated = await localStorage.getRecentSearches();
  expect(updated).toHaveLength(10);
  expect(updated[0].id).toBe("5");
  expect(updated.filter((item) => item.id === "5")).toHaveLength(1);
  await localStorage.clearRecentSearches();
  expect(await localStorage.getRecentSearches()).toEqual([]);
});

it("recupera pesquisa recente corrompida sem travar a leitura", async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("JSON inválido");
  expect(await localStorage.getRecentSearches()).toEqual([]);
});
