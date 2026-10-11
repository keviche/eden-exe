import { describe, expect, it } from "vitest";
import { getCityDayKey, getDayPhase, selectWeatherCondition } from "../simulation/worldDefaults";

describe("world time", () => {
  it("uses a ten minute day/night cycle with sunset at five minutes", () => {
    expect(getDayPhase(0)).toBe("day");
    expect(getDayPhase(60)).toBe("day");
    expect(getDayPhase(299.99)).toBe("day");
    expect(getDayPhase(300)).toBe("sunset");
    expect(getDayPhase(359.99)).toBe("sunset");
    expect(getDayPhase(360)).toBe("night");
    expect(getDayPhase(599.99)).toBe("night");
    expect(getDayPhase(600)).toBe("day");
  });

  it("assigns pre-4 AM times to the previous local city day", () => {
    expect(getCityDayKey(new Date(2026, 9, 10, 3, 59))).toBe("2026-10-09");
    expect(getCityDayKey(new Date(2026, 9, 10, 4, 0))).toBe("2026-10-10");
  });

  it("selects the configured weather bands through an injectable random source", () => {
    expect(selectWeatherCondition(() => 0.2)).toBe("sunny");
    expect(selectWeatherCondition(() => 0.7)).toBe("cloudy");
    expect(selectWeatherCondition(() => 0.95)).toBe("rainy");
  });
});
