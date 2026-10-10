import { create } from "zustand";
import type {
  ActivityCategory,
  Building,
  EntityId,
  Plant,
  Resident,
  Weather,
  WorldState,
} from "../simulation/types";
import { DEFAULT_WORLD_STATE } from "../simulation/worldDefaults";

const IDLE_AFTER_MS = 60_000;
const BUILDING_INTERVAL = 60;
const PLANT_INTERVAL = 45;
const RESIDENT_INTERVAL = 90;

interface WorldStore {
  world: WorldState;
  resetWorld: () => void;
  loadWorld: (world: WorldState) => void;
  addBuilding: (building: Building) => void;
  removeBuilding: (id: EntityId) => void;
  addPlant: (plant: Plant) => void;
  removePlant: (id: EntityId) => void;
  addResident: (resident: Resident) => void;
  removeResident: (id: EntityId) => void;
  setActivityCategory: (category: ActivityCategory, at?: number) => void;
  recordInput: (at?: number) => void;
  addActivityPoints: (category: ActivityCategory, points: number) => void;
  unlockBuilding: (buildingType: string) => void;
  advanceTime: (seconds: number, at?: number) => void;
  setWeather: (weather: Weather) => void;
}

const freshWorld = (): WorldState => structuredClone(DEFAULT_WORLD_STATE);
const createId = (type: string) =>
  `${type}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function randomCell(seed: number, max: number) {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return { seed: nextSeed, value: Math.floor((nextSeed / 0x1_0000_0000) * max) };
}

function placeBuilding(world: WorldState, at: number): Partial<WorldState> {
  const ordinal = world.buildings.length;
  const variantId = ordinal % 2 === 0 ? "solar-workshop" : "canopy-house";
  const x = randomCell(world.seed.seed, world.grid.width - 1);
  const z = randomCell(x.seed, world.grid.depth - 1);
  const building: Building = {
    type: "building",
    id: createId("building"),
    variantId,
    name: variantId === "solar-workshop" ? "Solar Workshop" : "Canopy House",
    gridPosition: { x: x.value, z: z.value },
    footprint: { width: 2, depth: 2 },
    rotation: 0,
    createdAt: at,
  };
  return { seed: { seed: z.seed }, buildings: [...world.buildings, building] };
}

function placePlant(world: WorldState, at: number): Partial<WorldState> {
  const x = randomCell(world.seed.seed, world.grid.width);
  const z = randomCell(x.seed, world.grid.depth);
  const species = world.plants.length % 2 === 0 ? "broadleaf" : "fern";
  const plant: Plant = {
    type: "plant",
    id: createId("plant"),
    species,
    variantId: species,
    gridPosition: { x: x.value, z: z.value },
    growth: 0.25,
    createdAt: at,
  };
  return { seed: { seed: z.seed }, plants: [...world.plants, plant] };
}

function placeResident(world: WorldState, at: number): Partial<WorldState> {
  const x = randomCell(world.seed.seed, world.grid.width);
  const z = randomCell(x.seed, world.grid.depth);
  const resident: Resident = {
    type: "resident",
    id: createId("resident"),
    name: `Resident ${world.residents.length + 1}`,
    position: {
      x: (x.value - (world.grid.width - 1) / 2) * world.grid.cellSize,
      y: 0,
      z: (z.value - (world.grid.depth - 1) / 2) * world.grid.cellSize,
    },
    activity: "socializing",
    createdAt: at,
  };
  return { seed: { seed: z.seed }, residents: [...world.residents, resident] };
}

export const useWorldStore = create<WorldStore>((set) => ({
  world: freshWorld(),
  resetWorld: () => set({ world: freshWorld() }),
  loadWorld: (world) => set({ world: structuredClone(world) }),

  addBuilding: (building) =>
    set((state) => ({
      world: { ...state.world, buildings: [...state.world.buildings, structuredClone(building)] },
    })),
  removeBuilding: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        buildings: state.world.buildings.filter((building) => building.id !== id),
      },
    })),
  addPlant: (plant) =>
    set((state) => ({
      world: { ...state.world, plants: [...state.world.plants, structuredClone(plant)] },
    })),
  removePlant: (id) =>
    set((state) => ({
      world: { ...state.world, plants: state.world.plants.filter((plant) => plant.id !== id) },
    })),
  addResident: (resident) =>
    set((state) => ({
      world: { ...state.world, residents: [...state.world.residents, structuredClone(resident)] },
    })),
  removeResident: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        residents: state.world.residents.filter((resident) => resident.id !== id),
      },
    })),

  setActivityCategory: (category, at = Date.now()) =>
    set((state) => ({
      world: { ...state.world, activity: { ...state.world.activity, category }, lastActiveAt: at },
    })),
  recordInput: (at = Date.now()) =>
    set((state) => ({
      world: {
        ...state.world,
        lastActiveAt: at,
        activity: {
          ...state.world.activity,
          category:
            state.world.activity.category === "idle"
              ? "productivity"
              : state.world.activity.category,
        },
      },
    })),
  addActivityPoints: (category, points) => {
    if (!Number.isFinite(points) || points <= 0) return;
    const key = {
      productivity: "productivityPoints",
      leisure: "leisurePoints",
      idle: "idlePoints",
    } as const;
    const pointKey = key[category];
    set((state) => ({
      world: {
        ...state.world,
        activity: { ...state.world.activity, [pointKey]: state.world.activity[pointKey] + points },
      },
    }));
  },
  unlockBuilding: (buildingType) =>
    set((state) => {
      if (state.world.progression.unlockedBuildings.includes(buildingType)) return state;
      return {
        world: {
          ...state.world,
          progression: {
            ...state.world.progression,
            unlockedBuildings: [...state.world.progression.unlockedBuildings, buildingType],
          },
        },
      };
    }),

  advanceTime: (seconds, at = Date.now()) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const elapsed = seconds;
    set((state) => {
      let world = state.world;
      const category: ActivityCategory =
        at - world.lastActiveAt >= IDLE_AFTER_MS ? "idle" : world.activity.category;
      const pointKey = {
        productivity: "productivityPoints",
        leisure: "leisurePoints",
        idle: "idlePoints",
      } as const;
      const activity = {
        ...world.activity,
        category,
        [pointKey[category]]: world.activity[pointKey[category]] + elapsed,
      };
      world = { ...world, activity, simulationTime: world.simulationTime + elapsed };

      if (
        category === "productivity" &&
        activity.productivityPoints >= (world.buildings.length + 1) * BUILDING_INTERVAL
      ) {
        world = { ...world, ...placeBuilding(world, at) };
      } else if (
        category === "idle" &&
        activity.idlePoints >= (world.plants.length + 1) * PLANT_INTERVAL
      ) {
        world = { ...world, ...placePlant(world, at) };
      } else if (
        category === "leisure" &&
        activity.leisurePoints >= (world.residents.length + 1) * RESIDENT_INTERVAL
      ) {
        world = { ...world, ...placeResident(world, at) };
      }
      return { world };
    });
  },
  setWeather: (weather) =>
    set((state) => ({ world: { ...state.world, weather: structuredClone(weather) } })),
}));

export const selectBuildings = (state: WorldStore) => state.world.buildings;
export const selectPlants = (state: WorldStore) => state.world.plants;
export const selectResidents = (state: WorldStore) => state.world.residents;
export const selectWeather = (state: WorldStore) => state.world.weather;
export const selectActivity = (state: WorldStore) => state.world.activity;
export const selectProgression = (state: WorldStore) => state.world.progression;
export const selectSimulationTime = (state: WorldStore) => state.world.simulationTime;
