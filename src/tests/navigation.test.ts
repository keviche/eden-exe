import { describe, expect, it } from "vitest";
import type { Building } from "../simulation/types";
import { findResidentPath } from "../simulation/navigation";

describe("resident navigation", () => {
  it("routes around rotated building footprints without entering blocked cells", () => {
    const building: Building = {
      type: "building",
      id: "rotated",
      name: "Rotated building",
      variantId: "solar-house",
      gridPosition: { x: 2, z: 1 },
      footprint: { width: 1, depth: 3 },
      rotation: Math.PI / 2,
      floors: 3,
      createdAt: 0,
    };
    const path = findResidentPath({ x: 0, z: 1 }, { x: 6, z: 1 }, [building], []);
    expect(path).not.toBeNull();
    expect(path!.some(cell => cell.z === 1 && cell.x >= 2 && cell.x < 5)).toBe(false);
    const completePath = [{ x: 0, z: 1 }, ...path!];
    expect(completePath.every((cell, index) => index === 0 || Math.abs(cell.x - completePath[index - 1]!.x) + Math.abs(cell.z - completePath[index - 1]!.z) === 1)).toBe(true);
  });

  it("returns no route when the destination is blocked", () => {
    const building: Building = {
      type: "building",
      id: "blocker",
      name: "Blocker",
      variantId: "solar-house",
      gridPosition: { x: 3, z: 3 },
      footprint: { width: 2, depth: 2 },
      rotation: 0,
      createdAt: 0,
    };
    expect(findResidentPath({ x: 1, z: 3 }, { x: 3, z: 3 }, [building], [])).toBeNull();
  });
});
