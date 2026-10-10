import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_WORLD_STATE } from "./worldDefaults";
import type { ActivityCategory, WorldState } from "./types";

const STORAGE_KEY = "eden-world-v1";
const IDLE_AFTER_MS = 60_000;

function nextRandom(seed: number) {
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { seed: next, value: next / 0x1_0000_0000 };
}

function cell(seed: number, limit: number) {
  const result = nextRandom(seed);
  return { seed: result.seed, value: Math.floor(result.value * limit) };
}

type WorldStore = WorldState & {
  recordInput: (at?: number) => void;
  setActivity: (activity: ActivityCategory) => void;
  tick: (seconds?: number, at?: number) => void;
  reset: () => void;
};

export const useWorldStore = create<WorldStore>()(persist((set) => ({
  ...DEFAULT_WORLD_STATE,
  recordInput: (at = Date.now()) => set((state) => ({
    lastActiveAt: at,
    activity: at - state.lastActiveAt >= IDLE_AFTER_MS ? "productivity" : state.activity === "idle" ? "productivity" : state.activity,
  })),
  setActivity: (activity) => set({ activity, lastActiveAt: Date.now() }),
  reset: () => set({ ...DEFAULT_WORLD_STATE, lastActiveAt: Date.now() }),
  tick: (seconds = 1, at = Date.now()) => set((state) => {
    const elapsed = Math.max(0, Math.min(seconds, 10));
    const activity: ActivityCategory = at - state.lastActiveAt >= IDLE_AFTER_MS ? "idle" : state.activity;
    const progression = { ...state.progression };
    if (activity === "productivity") progression.productivitySeconds += elapsed;
    if (activity === "leisure") progression.leisureSeconds += elapsed;
    if (activity === "idle") progression.idleSeconds += elapsed;
    let seed = state.seed.seed;
    const buildings = [...state.buildings];
    const plants = [...state.plants];
    const residents = [...state.residents];

    // A small, slow cadence keeps each activity legible in a first run.
    if (activity === "productivity" && progression.productivitySeconds >= (buildings.length + 1) * 60) {
      const x = cell(seed, state.grid.width); seed = x.seed;
      const z = cell(seed, state.grid.depth); seed = z.seed;
      buildings.push({ id: `building-${buildings.length + 1}`, name: buildings.length % 2 ? "Canopy House" : "Solar Workshop", gridPosition: { x: x.value, z: z.value }, footprint: { width: 2, depth: 2 }, rotation: 0, createdAt: at });
    }
    if (activity === "idle" && progression.idleSeconds >= (plants.length + 1) * 45) {
      const x = cell(seed, state.grid.width); seed = x.seed;
      const z = cell(seed, state.grid.depth); seed = z.seed;
      plants.push({ id: `plant-${plants.length + 1}`, species: plants.length % 2 ? "fern" : "broadleaf", gridPosition: { x: x.value, z: z.value }, growth: 0.25, createdAt: at });
    }
    if (activity === "leisure" && progression.leisureSeconds >= (residents.length + 1) * 90) {
      const x = cell(seed, state.grid.width); seed = x.seed;
      const z = cell(seed, state.grid.depth); seed = z.seed;
      residents.push({ id: `resident-${residents.length + 1}`, name: `Resident ${residents.length + 1}`, position: { x: (x.value - state.grid.width / 2) * state.grid.cellSize, y: 0, z: (z.value - state.grid.depth / 2) * state.grid.cellSize }, activity: "socializing", createdAt: at });
    }
    return { activity, progression, simulationTime: state.simulationTime + elapsed, seed: { seed }, buildings, plants, residents };
  }),
}), {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ seed: state.seed, grid: state.grid, buildings: state.buildings, plants: state.plants, residents: state.residents, weather: state.weather, simulationTime: state.simulationTime, activity: state.activity, lastActiveAt: state.lastActiveAt, progression: state.progression }) as WorldStore,
  }));

export { IDLE_AFTER_MS };
