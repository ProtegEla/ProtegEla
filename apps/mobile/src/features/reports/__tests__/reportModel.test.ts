import { elapsed, isValidCoordinates } from "../reportModel";

describe("coordenadas de incidentes", () => {
  it.each([[90, 180], [-90, -180], [0, 0], [-23.55, -46.63]])(
    "aceita latitude %s e longitude %s",
    (latitude, longitude) => {
      expect(isValidCoordinates({ latitude, longitude })).toBe(true);
    },
  );

  it.each([[90.001, 0], [-90.001, 0], [0, 180.001], [0, -180.001],
    [NaN, 0], [0, NaN], [Infinity, 0], [0, -Infinity]])(
    "rejeita latitude %s e longitude %s",
    (latitude, longitude) => {
      expect(isValidCoordinates({ latitude, longitude })).toBe(false);
    },
  );
});

describe("tempo decorrido do relato", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-26T15:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    [0, "Agora"], [59, "Agora"], [60, "Há 1 min"],
    [3599, "Há 59 min"], [3600, "Há 1 h"],
    [86399, "Há 23 h"], [86400, "Há 1 dia"], [172800, "Há 2 dias"],
    [-60, "Agora"],
  ])("formata o limite de %s segundos", (seconds, expected) => {
    expect(elapsed(new Date(Date.now() - seconds * 1000).toISOString())).toBe(expected);
  });

  it("trata datas inválidas", () => {
    expect(elapsed("data inválida")).toBe("Data indisponível");
  });
});
