
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
      name: "Solar House",
      gridPosition: { x: 5, z: 10 },
      footprint: { width: 2, depth: 2 },
      rotation: 0,
      createdAt: Date.now(),
    };

    useWorldStore.getState().addBuilding(building);

    expect(useWorldStore.getState().world.buildings).toHaveLength(1);
    expect(useWorldStore.getState().world.buildings[0].name).toBe(
      "Solar House",
    );

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

  it("prevents duplicate building unlocks", () => {
    const store = useWorldStore.getState();

    store.unlockBuilding("solar-house");
    store.unlockBuilding("solar-house");

    expect(
      useWorldStore.getState().world.progression.unlockedBuildings,
    ).toEqual(["solar-house"]);
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
