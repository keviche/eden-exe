import type {
  ActivityState,
  ProgressionState,
  Weather,
  WorldGrid,
  WorldSeed,
  WorldState,
} from "./types";

export const DEFAULT_WORLD_SEED: WorldSeed = { seed: 12345 };

export const DEFAULT_WORLD_GRID: WorldGrid = {
  width: 6,
  depth: 6,
  cellSize: 2,
  origin: { x: 0, y: 0, z: 0 },
};

export const DEFAULT_WEATHER: Weather = { condition: "sunny", updatedAt: Date.now() };
export const DEFAULT_ACTIVITY_STATE: ActivityState = {
  category: "idle",
  productivityPoints: 0,
  leisurePoints: 0,
  idlePoints: 0,
};
export const DEFAULT_PROGRESSION_STATE: ProgressionState = { unlockedBuildings: [] };

export const DEFAULT_WORLD_STATE: WorldState = {
  seed: DEFAULT_WORLD_SEED,
  grid: DEFAULT_WORLD_GRID,
  buildings: [],
  plants: [],
  residents: [],
  weather: DEFAULT_WEATHER,
  simulationTime: 0,
  activity: DEFAULT_ACTIVITY_STATE,
  lastActiveAt: Date.now(),
  progression: DEFAULT_PROGRESSION_STATE,
};
