
import type {
  WorldState,
  WorldGrid,
  WorldSeed,
  Weather,
  ActivityState,
  ProgressionState,
} from "./types";

// --------------------------------------------------
// World generation defaults
// --------------------------------------------------

export const DEFAULT_WORLD_SEED: WorldSeed = {
  seed: 12345,
};

// --------------------------------------------------
// Grid configuration
// --------------------------------------------------

export const DEFAULT_WORLD_GRID: WorldGrid = {
  // Number of grid cells along each axis.
  width: 100,
  depth: 100,

  // Each grid cell spans 2 Three.js world units.
  cellSize: 2,

  // World-space origin of the grid.
  origin: {
    x: 0,
    y: 0,
    z: 0,
  },
};

// --------------------------------------------------
// Weather defaults
// --------------------------------------------------

export const DEFAULT_WEATHER: Weather = {
  condition: "sunny",
  updatedAt: Date.now(),
};

// --------------------------------------------------
// Activity defaults
// --------------------------------------------------

export const DEFAULT_ACTIVITY_STATE: ActivityState = {
  category: "idle",
  productivityPoints: 0,
  leisurePoints: 0,
  idlePoints: 0,
};

// --------------------------------------------------
// Progression defaults
// --------------------------------------------------

export const DEFAULT_PROGRESSION_STATE: ProgressionState = {
  unlockedBuildings: [],
};

// --------------------------------------------------
// Initial world state
// --------------------------------------------------

export const DEFAULT_WORLD_STATE: WorldState = {
  seed: DEFAULT_WORLD_SEED,
  grid: DEFAULT_WORLD_GRID,

  // The world starts without generated entities.
  buildings: [],
  plants: [],
  residents: [],

  weather: DEFAULT_WEATHER,

  // Elapsed simulation time in seconds.
  simulationTime: 0,
<<<<<<< Updated upstream

  // Current computer activity and accumulated points.
  activity: DEFAULT_ACTIVITY_STATE,

  // Unlocked buildings and progression.
  progression: DEFAULT_PROGRESSION_STATE,
=======
  activity: "idle",
  lastActiveAt: Date.now(),
  progression: { productivitySeconds: 0, leisureSeconds: 0, idleSeconds: 0 },
>>>>>>> Stashed changes
};
