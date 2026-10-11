
import { create } from "zustand";

import type {
  ActivityCategory,
  Building,
  BuildingKind,
  EntityId,
  Plant,
  Resident,
  Weather,
  WorldState,
} from "../simulation/types";

import { DEFAULT_WORLD_STATE } from "../simulation/worldDefaults";

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const BUILDING_INTERVAL = 20;
const BUILDING_GROWTH_INTERVAL = 30;
const NATURE_GROWTH_INTERVAL = 30;

const PLANT_INTERVAL = 45;
const RESIDENT_INTERVAL = 90;

const MAX_BUILDING_LEVEL = 5;
const NATURE_GROWTH_PER_INTERVAL = 0.2;

type NonIdleCategory = "productivity" | "leisure";

interface WorldStore {
  world: WorldState;

  systemIdle: boolean;
  lastNonIdleCategory: NonIdleCategory;

  setSystemIdle: (idle: boolean) => void;

  resetWorld: () => void;
  loadWorld: (world: WorldState) => void;

  addBuilding: (building: Building) => void;
  removeBuilding: (id: EntityId) => void;

  addPlant: (plant: Plant) => void;
  removePlant: (id: EntityId) => void;

  addResident: (resident: Resident) => void;
  removeResident: (id: EntityId) => void;

  setActivityCategory: (
    category: ActivityCategory,
    at?: number
  ) => void;

  recordInput: (at?: number) => void;

  addActivityPoints: (
    category: ActivityCategory,
    points: number
  ) => void;

  unlockBuilding: (buildingType: string) => void;

  advanceTime: (seconds: number, at?: number) => void;

  setWeather: (weather: Weather) => void;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function freshWorld(): WorldState {
  return structuredClone(DEFAULT_WORLD_STATE);
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nonIdleCategory(
  category: ActivityCategory,
  fallback: NonIdleCategory = "productivity"
): NonIdleCategory {
  return category === "productivity" || category === "leisure"
    ? category
    : fallback;
}

// Deterministic seeded random numbers.
function nextRandom(seed: number): {
  seed: number;
  value: number;
} {
  const nextSeed =
    (Math.imul(seed, 1664525) + 1013904223) >>> 0;

  return {
    seed: nextSeed,
    value: nextSeed / 4294967296,
  };
}

function randomIndex(
  seed: number,
  length: number
): {
  seed: number;
  index: number;
} {
  const result = nextRandom(seed);

  return {
    seed: result.seed,
    index: Math.floor(result.value * length),
  };
}

// --------------------------------------------------
// Building definitions
// --------------------------------------------------

const BUILDING_VARIANTS: {
  kind: BuildingKind;
  variantId: string;
  name: string;
}[] = [
  {
    kind: "house",
    variantId: "canopy-house",
    name: "Canopy House",
  },
  {
    kind: "workshop",
    variantId: "solar-workshop",
    name: "Solar Workshop",
  },
  {
    kind: "school",
    variantId: "school",
    name: "School",
  },
  {
    kind: "library",
    variantId: "library",
    name: "Library",
  },
  {
    kind: "restaurant",
    variantId: "restaurant",
    name: "Restaurant",
  },
  {
    kind: "cafe",
    variantId: "cafe",
    name: "Cafe",
  },
  {
    kind: "arcade",
    variantId: "arcade",
    name: "Arcade",
  },
  {
    kind: "recreation-center",
    variantId: "recreation-center",
    name: "Recreation Center",
  },
];

// --------------------------------------------------
// Collision detection
// --------------------------------------------------

function overlapsBuilding(
  world: WorldState,
  x: number,
  z: number,
  width: number,
  depth: number
): boolean {
  return world.buildings.some((building) => {
    const bx = building.gridPosition.x;
    const bz = building.gridPosition.z;

    const bw = building.footprint.width;
    const bd = building.footprint.depth;

    return (
      x < bx + bw &&
      x + width > bx &&
      z < bz + bd &&
      z + depth > bz
    );
  });
}

function availableBuildingCells(world: WorldState) {
  const available: { x: number; z: number }[] = [];

  for (let x = 0; x < world.grid.width; x++) {
    for (let z = 0; z < world.grid.depth; z++) {
      if (!overlapsBuilding(world, x, z, 1, 1)) {
        available.push({ x, z });
      }
    }
  }

  return available;
}

// --------------------------------------------------
// Automatic building spawning
// --------------------------------------------------

function placeBuilding(
  world: WorldState,
  at: number
): Partial<WorldState> {
  const available = availableBuildingCells(world);

  if (available.length === 0) {
    return {};
  }

  let seed = world.seed.seed;

  // Random location.
  const positionChoice = randomIndex(seed, available.length);
  seed = positionChoice.seed;

  const position = available[positionChoice.index];

  // Random building type.
  const typeChoice = randomIndex(seed, BUILDING_VARIANTS.length);
  seed = typeChoice.seed;

  const definition = BUILDING_VARIANTS[typeChoice.index];

  // Random rotation.
  const rotationChoice = randomIndex(seed, 4);
  seed = rotationChoice.seed;

  const building: Building = {
    type: "building",
    id: createId("building"),

    name: definition.name,
    variantId: definition.variantId,
    kind: definition.kind,

    level: 1,
    natureGrowth: 0,

    gridPosition: position,

    footprint: {
      width: 1,
      depth: 1,
    },

    rotation: rotationChoice.index * (Math.PI / 2),
    createdAt: at,
  };

  return {
    seed: { seed },
    buildings: [...world.buildings, building],
  };
}

// --------------------------------------------------
// Random building growth
// --------------------------------------------------

function growBuildings(
  world: WorldState,
  previousPoints: number,
  currentPoints: number,
  category: NonIdleCategory
): Partial<WorldState> {
  const interval =
    category === "productivity"
      ? BUILDING_GROWTH_INTERVAL
      : NATURE_GROWTH_INTERVAL;

  const milestones =
    Math.floor(currentPoints / interval) -
    Math.floor(previousPoints / interval);

  if (milestones <= 0 || world.buildings.length === 0) {
    return {};
  }

  let seed = world.seed.seed;

  const buildings = world.buildings.map((building) => ({
    ...building,
  }));

  for (let i = 0; i < milestones; i++) {
    const eligibleIndices: number[] = [];

    buildings.forEach((building, index) => {
      if (
        category === "productivity" &&
        (building.level ?? 1) < MAX_BUILDING_LEVEL
      ) {
        eligibleIndices.push(index);
      }

      if (
        category === "leisure" &&
        (building.natureGrowth ?? 0) < 0.999
      ) {
        eligibleIndices.push(index);
      }
    });

    if (eligibleIndices.length === 0) break;

    const choice = randomIndex(seed, eligibleIndices.length);
    seed = choice.seed;

    const index = eligibleIndices[choice.index];
    const target = buildings[index];

    if (category === "productivity") {
      target.level = Math.min(
        MAX_BUILDING_LEVEL,
        (target.level ?? 1) + 1
      );
    } else {
      target.natureGrowth = Math.min(
        1,
        Number(
          (
            (target.natureGrowth ?? 0) +
            NATURE_GROWTH_PER_INTERVAL
          ).toFixed(2)
        )
      );
    }
  }

  return {
    seed: { seed },
    buildings,
  };
}

// --------------------------------------------------
// Plant spawning
// --------------------------------------------------

function placePlant(
  world: WorldState,
  at: number
): Partial<WorldState> {
  let seed = world.seed.seed;

  const xChoice = randomIndex(seed, world.grid.width);
  seed = xChoice.seed;

  const zChoice = randomIndex(seed, world.grid.depth);
  seed = zChoice.seed;

  const typeChoice = randomIndex(seed, 2);
  seed = typeChoice.seed;

  const species =
    typeChoice.index === 0 ? "broadleaf" : "fern";

  const plant: Plant = {
    type: "plant",
    id: createId("plant"),

    species,
    variantId: species,

    gridPosition: {
      x: xChoice.index,
      z: zChoice.index,
    },

    growth: 0.25,
    createdAt: at,
  };

  return {
    seed: { seed },
    plants: [...world.plants, plant],
  };
}

// --------------------------------------------------
// Resident spawning
// --------------------------------------------------

function placeResident(
  world: WorldState,
  at: number
): Partial<WorldState> {
  let seed = world.seed.seed;

  const xChoice = randomIndex(seed, world.grid.width);
  seed = xChoice.seed;

  const zChoice = randomIndex(seed, world.grid.depth);
  seed = zChoice.seed;

  const resident: Resident = {
    type: "resident",
    id: createId("resident"),

    name: `Resident ${world.residents.length + 1}`,

    position: {
      x:
        (xChoice.index - (world.grid.width - 1) / 2) *
        world.grid.cellSize,
      y: 0,
      z:
        (zChoice.index - (world.grid.depth - 1) / 2) *
        world.grid.cellSize,
    },

    activity: "socializing",
    createdAt: at,
  };

  return {
    seed: { seed },
    residents: [...world.residents, resident],
  };
}

// --------------------------------------------------
// Store
// --------------------------------------------------

export const useWorldStore = create<WorldStore>((set) => ({
  world: freshWorld(),

  systemIdle: false,

  lastNonIdleCategory: nonIdleCategory(
    DEFAULT_WORLD_STATE.activity.category
  ),

  // ------------------------------------------------
  // System idle
  // ------------------------------------------------

  setSystemIdle: (idle) =>
    set((state) => {
      if (state.systemIdle === idle) return state;

      const lastNonIdleCategory = nonIdleCategory(
        state.world.activity.category,
        state.lastNonIdleCategory
      );

      return {
        systemIdle: idle,
        lastNonIdleCategory,

        world: {
          ...state.world,

          lastActiveAt: idle
            ? state.world.lastActiveAt
            : Date.now(),

          activity: {
            ...state.world.activity,
            category: idle
              ? "idle"
              : lastNonIdleCategory,
          },
        },
      };
    }),

  // ------------------------------------------------
  // World lifecycle
  // ------------------------------------------------

  resetWorld: () =>
    set((state) => {
      const world = freshWorld();

      const lastNonIdleCategory = nonIdleCategory(
        world.activity.category
      );

      if (state.systemIdle) {
        world.activity.category = "idle";
      }

      return {
        world,
        lastNonIdleCategory,
      };
    }),

  loadWorld: (savedWorld) =>
    set((state) => {
      const world = structuredClone(savedWorld);

      world.buildings = world.buildings.map((building) => ({
        ...building,

        kind:
          building.kind ??
          (building.variantId === "solar-workshop"
            ? "workshop"
            : "house"),

        level: building.level ?? 1,
        natureGrowth: building.natureGrowth ?? 0,
      }));

      const lastNonIdleCategory = nonIdleCategory(
        world.activity.category,
        state.lastNonIdleCategory
      );

      if (state.systemIdle) {
        world.activity.category = "idle";
      } else if (world.activity.category === "idle") {
        world.activity.category = lastNonIdleCategory;
      }

      return {
        world,
        lastNonIdleCategory,
      };
    }),

  // ------------------------------------------------
  // Entities
  // ------------------------------------------------

  addBuilding: (building) =>
    set((state) => ({
      world: {
        ...state.world,
        buildings: [
          ...state.world.buildings,
          structuredClone(building),
        ],
      },
    })),

  removeBuilding: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        buildings: state.world.buildings.filter(
          (building) => building.id !== id
        ),
      },
    })),

  addPlant: (plant) =>
    set((state) => ({
      world: {
        ...state.world,
        plants: [
          ...state.world.plants,
          structuredClone(plant),
        ],
      },
    })),

  removePlant: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        plants: state.world.plants.filter(
          (plant) => plant.id !== id
        ),
      },
    })),

  addResident: (resident) =>
    set((state) => ({
      world: {
        ...state.world,
        residents: [
          ...state.world.residents,
          structuredClone(resident),
        ],
      },
    })),

  removeResident: (id) =>
    set((state) => ({
      world: {
        ...state.world,
        residents: state.world.residents.filter(
          (resident) => resident.id !== id
        ),
      },
    })),

  // ------------------------------------------------
  // Activity
  // ------------------------------------------------

  setActivityCategory: (
    category,
    at = Date.now()
  ) =>
    set((state) => {
      const lastNonIdleCategory = nonIdleCategory(
        category,
        state.lastNonIdleCategory
      );

      return {
        lastNonIdleCategory,

        world: {
          ...state.world,
          lastActiveAt: at,

          activity: {
            ...state.world.activity,

            category: state.systemIdle
              ? "idle"
              : category,
          },
        },
      };
    }),

  recordInput: (at = Date.now()) =>
    set((state) => ({
      world: {
        ...state.world,
        lastActiveAt: at,

        activity: {
          ...state.world.activity,

          category: state.systemIdle
            ? "idle"
            : nonIdleCategory(
                state.world.activity.category,
                state.lastNonIdleCategory
              ),
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

    set((state) => ({
      world: {
        ...state.world,

        activity: {
          ...state.world.activity,

          [key[category]]:
            state.world.activity[key[category]] + points,
        },
      },
    }));
  },

  // ------------------------------------------------
  // Progression
  // ------------------------------------------------

  unlockBuilding: (buildingType) =>
    set((state) => {
      if (
        state.world.progression.unlockedBuildings.includes(
          buildingType
        )
      ) {
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

  advanceTime: (seconds, at = Date.now()) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    set((state) => {
      let world = state.world;

      const category: ActivityCategory = state.systemIdle
        ? "idle"
        : nonIdleCategory(
            world.activity.category,
            state.lastNonIdleCategory
          );

      const pointKey = {
        productivity: "productivityPoints",
        leisure: "leisurePoints",
        idle: "idlePoints",
      } as const;

      const activity = {
        ...world.activity,
        category,

        [pointKey[category]]:
          world.activity[pointKey[category]] + seconds,
      };

      world = {
        ...world,
        activity,
        simulationTime: world.simulationTime + seconds,
      };

      // Random productivity upgrades.
      if (category === "productivity") {
        world = {
          ...world,
          ...growBuildings(
            world,
            state.world.activity.productivityPoints,
            activity.productivityPoints,
            "productivity"
          ),
        };
      }

      // Random nature growth.
      if (category === "leisure") {
        world = {
          ...world,
          ...growBuildings(
            world,
            state.world.activity.leisurePoints,
            activity.leisurePoints,
            "leisure"
          ),
        };
      }

      // Automatic building spawning.
      if (category === "productivity") {
        const previousMilestone = Math.floor(
          state.world.activity.productivityPoints /
            BUILDING_INTERVAL
        );

        const currentMilestone = Math.floor(
          activity.productivityPoints /
            BUILDING_INTERVAL
        );

        for (
          let milestone = previousMilestone;
          milestone < currentMilestone;
          milestone++
        ) {
          world = {
            ...world,
            ...placeBuilding(world, at),
          };
        }
      }

      // Automatic plant spawning.
      if (category === "idle") {
        const previousMilestone = Math.floor(
          state.world.activity.idlePoints / PLANT_INTERVAL
        );

        const currentMilestone = Math.floor(
          activity.idlePoints / PLANT_INTERVAL
        );

        for (
          let milestone = previousMilestone;
          milestone < currentMilestone;
          milestone++
        ) {
          world = {
            ...world,
            ...placePlant(world, at),
          };
        }
      }

      // Automatic resident spawning.
      if (category === "leisure") {
        const previousMilestone = Math.floor(
          state.world.activity.leisurePoints /
            RESIDENT_INTERVAL
        );

        const currentMilestone = Math.floor(
          activity.leisurePoints /
            RESIDENT_INTERVAL
        );

        for (
          let milestone = previousMilestone;
          milestone < currentMilestone;
          milestone++
        ) {
          world = {
            ...world,
            ...placeResident(world, at),
          };
        }
      }

      return { world };
    });
  },

  // ------------------------------------------------
  // Weather
  // ------------------------------------------------

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
