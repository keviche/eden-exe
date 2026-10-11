import { beforeEach, describe, expect, it } from "vitest";
import { useWorldStore } from "../state/worldStore";

describe("WorldStore", () => {
  beforeEach(() => {
    useWorldStore.getState().resetWorld();
  });

  it("initializes an empty world", () => {
    const { world } = useWorldStore.getState();

    expect(world.buildings).toHaveLength(0);
    expect(world.plants).toHaveLength(0);
    expect(world.residents).toHaveLength(0);
    expect(world.activity.category).toBe("idle");
  });

  it("adds and removes a building", () => {
    const building = {
      type: "building" as const,
      id: "building-1",
      variantId: "solar-house",
      name: "Solar House",
      gridPosition: { x: 5, z: 10 },
      footprint: { width: 2, depth: 2 },
      rotation: 0,
      createdAt: Date.now(),
    };

    useWorldStore.getState().addBuilding(building);

    expect(useWorldStore.getState().world.buildings).toHaveLength(1);
    expect(useWorldStore.getState().world.buildings[0].name).toBe("Solar House");

    useWorldStore.getState().removeBuilding("building-1");

    expect(useWorldStore.getState().world.buildings).toHaveLength(0);
  });

  it("tracks computer activity points", () => {
    const store = useWorldStore.getState();

    store.setActivityCategory("productivity");
    store.addActivityPoints("productivity", 10);
    store.addActivityPoints("idle", 5);

    const { activity } = useWorldStore.getState().world;

    expect(activity.category).toBe("productivity");
    expect(activity.productivityPoints).toBe(10);
    expect(activity.idlePoints).toBe(5);
  });

  it("uses five activity points per city milestone and applies all crossed milestones once", () => {
    const store = useWorldStore.getState();
    store.addActivityPoints("productivity", 15);
    const { world } = useWorldStore.getState();
    expect(world.progression.consumedMilestones.productivity).toBe(3);
    expect(world.buildings.length).toBeGreaterThan(0);
    expect(world.buildings.every(item => (item.floors ?? 1) <= 5)).toBe(true);
    useWorldStore.getState().addActivityPoints("productivity", 0.1);
    expect(useWorldStore.getState().world.progression.consumedMilestones.productivity).toBe(3);
  });

  it("keeps category milestones independent", () => {
    const store = useWorldStore.getState();
    store.addActivityPoints("leisure", 5);
    store.addActivityPoints("idle", 5);
    const { world } = useWorldStore.getState();
    expect(world.plants).toHaveLength(1);
    expect(world.residents).toHaveLength(1);
    expect(world.progression.consumedMilestones).toEqual({ productivity: 0, leisure: 1, idle: 1 });
  });

  it("creates unique buildings and caps every generated or grown building at five floors", () => {
    useWorldStore.getState().addActivityPoints("productivity", 50);
    const buildings = useWorldStore.getState().world.buildings;
    expect(new Set(buildings.map(item => item.id)).size).toBe(buildings.length);
    expect(buildings.length).toBeGreaterThan(1);
    expect(buildings.every(item => (item.floors ?? 1) <= 5)).toBe(true);
  });

  it("resets the world once the 4 AM local city-day boundary is crossed", () => {
    const beforeBoundary = new Date(2026, 9, 10, 3, 59).getTime();
    const afterBoundary = new Date(2026, 9, 10, 4, 0).getTime();
    useWorldStore.getState().resetWorld(beforeBoundary);
    useWorldStore.getState().addActivityPoints("leisure", 5);
    useWorldStore.getState().advanceTime(1, afterBoundary);
    const { world } = useWorldStore.getState();
    expect(world.cityDayKey).toBe("2026-10-10");
    expect(world.plants).toHaveLength(0);
    expect(world.activity.leisurePoints).toBe(0);
    useWorldStore.getState().advanceTime(1, afterBoundary + 1_000);
    expect(useWorldStore.getState().world.cityDayKey).toBe("2026-10-10");
  });

  it("does not consume a building milestone when no placement is available", () => {
    const world = structuredClone(useWorldStore.getState().world);
    world.buildings = Array.from({ length: 400 }, (_, index) => ({
      type: "building" as const,
      id: `full-${index}`,
      name: "Full plot",
      variantId: "solar-house",
      gridPosition: { x: index % 20, z: Math.floor(index / 20) },
      footprint: { width: 1, depth: 1 },
      rotation: 0,
      floors: 5,
      createdAt: Date.now(),
    }));
    useWorldStore.getState().loadWorld(world);
    useWorldStore.getState().addActivityPoints("productivity", 5);
    expect(useWorldStore.getState().world.progression.consumedMilestones.productivity).toBe(0);
  });

  it("prevents duplicate building unlocks", () => {
    const store = useWorldStore.getState();

    store.unlockBuilding("solar-house");
    store.unlockBuilding("solar-house");

    expect(useWorldStore.getState().world.progression.unlockedBuildings).toEqual(["solar-house"]);
  });

  it("advances simulation time", () => {
    useWorldStore.getState().advanceTime(60);

    expect(useWorldStore.getState().world.simulationTime).toBe(60);
  });

  it("resets the world", () => {
    const store = useWorldStore.getState();

    store.addActivityPoints("leisure", 20);
    store.advanceTime(100);
    store.resetWorld();

    const { world } = useWorldStore.getState();

    expect(world.activity.leisurePoints).toBe(0);
    expect(world.simulationTime).toBe(0);
  });
});
