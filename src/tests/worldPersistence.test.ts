import { describe, expect, it } from "vitest";
import { normalizeSavedWorld } from "../state/worldPersistence";

describe("saved world normalization", () => {
  it("rejects values that do not contain the entity collections", () => {
    expect(normalizeSavedWorld(null)).toBeNull();
    expect(normalizeSavedWorld({ buildings: [], plants: [] })).toBeNull();
  });

  it("normalizes legacy worlds and enforces fixed grid and building limits", () => {
    const world = normalizeSavedWorld({
      world: {
        grid: { width: 70, depth: 4, cellSize: 9 },
        buildings: [{ floors: 99, moss: 2 }, { floors: -4 }],
        plants: [{}],
        residents: [{}],
        activity: "leisure",
        progression: { productivitySeconds: 12, leisureSeconds: 7, unlockedBuildings: ["solar-house", 2] },
        weather: { condition: "cloudy", updatedAt: 42 },
        simulationTime: 630,
      },
    });

    expect(world).not.toBeNull();
    expect(world!.grid).toMatchObject({ width: 20, depth: 20, cellSize: 1.5 });
    expect(world!.buildings.map(building => building.floors)).toEqual([5, 1]);
    expect(world!.buildings[0]!.moss).toBe(1);
    expect(world!.buildings[1]!.moss).toBe(0);
    expect(world!.buildings.map(building => building.id)).toEqual(["building-1", "building-2"]);
    expect(world!.plants[0]).toMatchObject({ type: "plant", id: "plant-1", species: "broadleaf", variantId: "broadleaf" });
    expect(world!.residents[0]).toMatchObject({ type: "resident", id: "resident-1" });
    expect(world!.activity).toMatchObject({ category: "leisure", productivityPoints: 12, leisurePoints: 7 });
    expect(world!.weather.condition).toBe("cloudy");
    expect(world!.simulationTime).toBe(630);
    expect(world!.progression.unlockedBuildings).toEqual(["solar-house"]);
  });

  it("falls back to safe defaults for invalid categories and weather", () => {
    const world = normalizeSavedWorld({ buildings: [], plants: [], residents: [], activity: "unknown", weather: { condition: "storm" } });
    expect(world!.activity.category).toBe("idle");
    expect(world!.weather.condition).toBe("sunny");
    expect(world!.progression.consumedMilestones).toEqual({ productivity: 0, leisure: 0, idle: 0 });
  });
});
