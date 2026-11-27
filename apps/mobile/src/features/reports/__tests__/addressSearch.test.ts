import { searchAddresses } from "../addressSearch";

afterEach(() => jest.restoreAllMocks());

it("filtra coordenadas inválidas e preserva o sinal de cancelamento", async () => {
  const signal = new AbortController().signal;
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => [
      null, { lat: "NaN", lon: "-46.63", display_name: "Inválido" },
      { lat: "91", lon: "0", display_name: "Fora do mapa" },
      { lat: "-23.55", lon: "-46.63" },
      { place_id: 7, lat: "-23.55", lon: "-46.63", display_name: "Praça" },
    ],
  } as Response);
  expect(await searchAddresses("  Praça  ", signal)).toEqual([
    { id: "7", label: "Praça", location: { latitude: -23.55, longitude: -46.63 } },
  ]);
  const [url, options] = fetchMock.mock.calls[0];
  expect(new URL(String(url)).searchParams.get("q")).toBe("Praça");
  expect(options?.signal).toBe(signal);
});

it("trata resposta inesperada como lista vazia", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true, json: async () => ({ error: "invalid" }),
  } as Response);
  expect(await searchAddresses("Praça")).toEqual([]);
});

it("informa erro HTTP sem retornar sugestões fictícias", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: false } as Response);
  await expect(searchAddresses("Praça")).rejects.toThrow("Não foi possível buscar o endereço");
});

it("propaga cancelamento para que a tela descarte a busca", async () => {
  const failure = new Error("AbortError");
  jest.spyOn(global, "fetch").mockRejectedValue(failure);
  await expect(searchAddresses("Praça")).rejects.toBe(failure);
});
