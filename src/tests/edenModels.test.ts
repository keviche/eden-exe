import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE, BUILDING_CATALOG, BUILDING_GROWTH_SECONDS, CELL_SIZE, GRID_SIZE,
  batchParts, buildingDimensions, buildingModel, buildingProgress, cellPoint, clamp01,
  compose, findFreePlantSite, findFreePlot, growthStage, hashId, multiply, plantModel,
} from "../edenModels";

describe("procedural world models and grid helpers", () => {
  it("keeps board dimensions aligned to the 20 by 20 grid", () => {
    expect(GRID_SIZE).toBe(20);
    expect(BOARD_SIZE).toBe(GRID_SIZE * CELL_SIZE);
    expect(cellPoint(9.5, 9.5)).toEqual({ x: 0, z: 0 });
    expect(cellPoint(0, 0)).toEqual({ x: -14.25, z: -14.25 });
  });

  it("clamps normalized values and derives growth progress and stages", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(4)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(buildingProgress({ createdAt: 0 }, BUILDING_GROWTH_SECONDS * 500)).toBe(0.5);
    expect(buildingProgress({ createdAt: 0 }, BUILDING_GROWTH_SECONDS * 1_000)).toBe(1);
    expect(buildingProgress({ createdAt: 0, growth: 0.7 }, 0)).toBe(0.7);
    expect(growthStage(0.2)).toBe(0);
    expect(growthStage(0.5)).toBe(1);
    expect(growthStage(0.9)).toBe(2);
  });

  it("swaps rectangular footprints after quarter-turn rotations", () => {
    expect(buildingDimensions({ width: 2, depth: 3 }, 0)).toEqual({ width: 2.65, depth: 4 });
    expect(buildingDimensions({ width: 2, depth: 3 }, Math.PI / 2)).toEqual({ width: 4.15, depth: 2.5 });
  });

  it("creates nonempty finite models for every building and plant variant", () => {
    for (const building of BUILDING_CATALOG) {
      for (const stage of [0, 1, 2]) {
        const parts = buildingModel(building.id, building.width * CELL_SIZE - 0.35, building.depth * CELL_SIZE - 0.5, stage, 37, 50);
        expect(parts.length, building.id).toBeGreaterThan(0);
        expect(parts.every(part => part.matrix.length === 16 && part.matrix.every(Number.isFinite)), building.id).toBe(true);
      }
    }
    for (const species of ["tree", "shrub", "fern", "flower", "grass"]) {
      const parts = plantModel(species, 19);
      expect(parts.length, species).toBeGreaterThan(0);
      expect(parts.every(part => part.matrix.length === 16 && part.matrix.every(Number.isFinite)), species).toBe(true);
    }
  });

  it("groups instance parts by geometry and finish and applies root transforms", () => {
    const model = buildingModel("solar-house", 2, 2, 0, 4);
    const batches = batchParts(model);
    expect(batches.length).toBeGreaterThan(1);
    expect(new Set(batches.map(batch => batch.key)).size).toBe(batches.length);
    const translation = compose([3, 4, 5]);
    expect(translation.slice(12, 15)).toEqual([3, 4, 5]);
    expect(multiply(translation, compose([1, 2, 3])).slice(12, 15)).toEqual([4, 6, 8]);
    expect(hashId("stable-id")).toBe(hashId("stable-id"));
  });

  it("selects free plots near the center and avoids occupied cells", () => {
    expect(findFreePlot([], [], 2, 2)).toEqual({ x: 9, z: 9 });
    const occupied = [{ gridPosition: { x: 9, z: 9 }, footprint: { width: 2, depth: 2 } }];
    const next = findFreePlot(occupied, [], 2, 2)!;
    expect(next).not.toEqual({ x: 9, z: 9 });
    expect(Math.abs(next.x - 9) + Math.abs(next.z - 9)).toBeLessThanOrEqual(2);
    expect(findFreePlot([], [], 21, 1)).toBeNull();
  });

  it("places plants at an injected free position and respects nearby occupants", () => {
    const random = () => 0.5;
    const open = findFreePlantSite([], random);
    expect(open).toEqual({ x: 10, z: 10 });
    let rolls = [0.5, 0.5, 0.8, 0.8];
    const skipBlocked = () => rolls.shift() ?? 0.8;
    const next = findFreePlantSite([{ gridPosition: { x: 9.5, z: 10 }, footprint: { width: 1, depth: 1 } }], skipBlocked);
    expect(next).toEqual({ x: 16, z: 16 });
  });
});
