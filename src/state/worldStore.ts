
import { create } from "zustand";

import type {
  WorldState,
  Building,
  Plant,
  Resident,
  EntityId,
  ActivityCategory,
  Weather,
} from "../simulation/types";

import { DEFAULT_WORLD_STATE } from "../simulation/worldDefaults";

// --------------------------------------------------
// Initial world
// --------------------------------------------------

// Create a fresh copy so arrays and nested objects
// are not shared with DEFAULT_WORLD_STATE.
const createInitialWorld = (): WorldState =>
  structuredClone(DEFAULT_WORLD_STATE);

// --------------------------------------------------
// Store interface
// --------------------------------------------------

interface WorldStore {
  world: WorldState;

  // World management
  resetWorld: () => void;
  loadWorld: (world: WorldState) => void;

  // Building management
  addBuilding: (building: Building) => void;
  removeBuilding: (id: EntityId) => void;

  // Plant management
  addPlant: (plant: Plant) => void;
  removePlant: (id: EntityId) => void;

  // Resident management
  addResident: (resident: Resident) => void;
  removeResident: (id: EntityId) => void;

  // Computer activity
  setActivityCategory: (category: ActivityCategory) => void;
  addActivityPoints: (
    category: ActivityCategory,
    points: number,
  ) => void;

  // World progression
  unlockBuilding: (buildingType: string) => void;

  // Simulation
  advanceTime: (seconds: number) => void;
  setWeather: (weather: Weather) => void;
}

// --------------------------------------------------
// Zustand store
// --------------------------------------------------

export const useWorldStore = create<WorldStore>((set) => ({
  world: createInitialWorld(),

  // ------------------------------------------------
  // World management
  // ------------------------------------------------

  resetWorld: () =>
    set({
      world: createInitialWorld(),
    }),

  loadWorld: (world) =>
    set({
      world: structuredClone(world),
    }),

  // ------------------------------------------------
  // Building management
  // ------------------------------------------------

  addBuilding: (building) =>
    set((state) => ({
      world: {
        ...state.world,
        buildings: [...state.world.buildings, structuredClone(building)],
      },
    })),

  removeBuilding: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        buildings: state.world.buildings.filter(
          (building) => building.id !== id,
        ),
      },
    })),

  // ------------------------------------------------
  // Plant management
  // ------------------------------------------------

  addPlant: (plant) =>
    set((state) => ({
      world: {
        ...state.world,
        plants: [...state.world.plants, structuredClone(plant)],
      },
    })),

  removePlant: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        plants: state.world.plants.filter(
          (plant) => plant.id !== id,
        ),
      },
    })),

  // ------------------------------------------------
  // Resident management
  // ------------------------------------------------

  addResident: (resident) =>
    set((state) => ({
      world: {
        ...state.world,
        residents: [...state.world.residents, structuredClone(resident)],
      },
    })),

  removeResident: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        residents: state.world.residents.filter(
          (resident) => resident.id !== id,
        ),
      },
    })),

  // ------------------------------------------------
  // Computer activity
  // ------------------------------------------------

  setActivityCategory: (category) =>
    set((state) => ({
      world: {
        ...state.world,
        activity: {
          ...state.world.activity,
          category,
        },
      },
    })),

  addActivityPoints: (category, points) => {
    if (!Number.isFinite(points) || points <= 0) return;

    const pointKey = {
      productivity: "productivityPoints",
      leisure: "leisurePoints",
      idle: "idlePoints",
    } as const;

    const key = pointKey[category];

    set((state) => ({
      world: {
        ...state.world,
        activity: {
          ...state.world.activity,
          [key]: state.world.activity[key] + points,
        },
      },
    }));
  },

  // ------------------------------------------------
  // World progression
  // ------------------------------------------------

  unlockBuilding: (buildingType) =>
    set((state) => {
      if (state.world.progression.unlockedBuildings.includes(buildingType)) {
        return state;
      }

      return {
        world: {
          ...state.world,
          progression: {
            ...state.world.progression,
            unlockedBuildings: [
              ...state.world.progression.unlockedBuildings,
              buildingType,
            ],
          },
        },
      };
    }),

  // ------------------------------------------------
  // Simulation
  // ------------------------------------------------

  advanceTime: (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;

    set((state) => ({
      world: {
        ...state.world,
        simulationTime: state.world.simulationTime + seconds,
      },
    }));
  },

  setWeather: (weather) =>
    set((state) => ({
      world: {
        ...state.world,
        weather: structuredClone(weather),
      },
    })),
}));

// --------------------------------------------------
// Selectors
// --------------------------------------------------

// Use these selectors in React components to subscribe
// only to the specific world data they need.

export const selectBuildings = (state: WorldStore) =>
  state.world.buildings;

export const selectPlants = (state: WorldStore) =>
  state.world.plants;

export const selectResidents = (state: WorldStore) =>
  state.world.residents;

export const selectWeather = (state: WorldStore) =>
  state.world.weather;

export const selectActivity = (state: WorldStore) =>
  state.world.activity;

export const selectProgression = (state: WorldStore) =>
  state.world.progression;

export const selectSimulationTime = (state: WorldStore) =>
  state.world.simulationTime;
