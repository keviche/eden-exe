import type {
  ActivityState,
  ProgressionState,
  Weather,
  WorldGrid,
  WorldState,
} from "./types";

export const DEFAULT_WORLD_GRID: WorldGrid = {
  width: 20,
  depth: 20,
  cellSize: 1.5,
  origin: { x: 0, y: 0, z: 0 },
};

export const DEFAULT_WEATHER: Weather = { condition: "sunny", updatedAt: Date.now(), cityDayKey: "" };
export const DEFAULT_ACTIVITY_STATE: ActivityState = {
  category: "idle",
  productivityPoints: 0,
  leisurePoints: 0,
  idlePoints: 0,
};
export const DEFAULT_PROGRESSION_STATE: ProgressionState = {
  unlockedBuildings: [],
  consumedMilestones: { productivity: 0, leisure: 0, idle: 0 },
};

export function getCityDayKey(date = new Date()): string {
  const local = new Date(date);
  if (local.getHours() < 4) local.setDate(local.getDate() - 1);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export const DEFAULT_CITY_DAY_KEY = getCityDayKey();

export type DayPhase = "day" | "sunset" | "night";
export function getDayPhase(elapsedSeconds: number): DayPhase {
  const minute = ((elapsedSeconds % 600) + 600) % 600 / 60;
  if (minute < 5) return "day";
  if (minute < 6) return "sunset";
  return "night";
}

export function selectWeatherCondition(random: () => number = Math.random): Weather["condition"] {
  const roll = random();
  return roll < 0.62 ? "sunny" : roll < 0.88 ? "cloudy" : "rainy";
}

export const DEFAULT_WORLD_STATE: WorldState = {
  grid: DEFAULT_WORLD_GRID,
  buildings: [],
  plants: [],
  residents: [],
  weather: DEFAULT_WEATHER,
  simulationTime: 0,
  activity: DEFAULT_ACTIVITY_STATE,
  lastActiveAt: Date.now(),
  progression: DEFAULT_PROGRESSION_STATE,
  cityDayKey: DEFAULT_CITY_DAY_KEY,
  cycleStartedAt: Date.now(),
};
