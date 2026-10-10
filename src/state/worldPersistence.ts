import { DEFAULT_WORLD_STATE } from "../simulation/worldDefaults";
import type { ActivityCategory, Building, Plant, Resident, WorldState } from "../simulation/types";
import { useWorldStore } from "./worldStore";

const BROWSER_SAVE_KEY = "eden-world-v1";
let initialized = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalize worlds saved by either side of the earlier merge. */
function normalizeWorld(input: unknown): WorldState | null {
  if (!isRecord(input)) return null;
  const source = isRecord(input.world) ? input.world : input;
  if (
    !Array.isArray(source.buildings) ||
    !Array.isArray(source.plants) ||
    !Array.isArray(source.residents)
  )
    return null;

  const activitySource = isRecord(source.activity) ? source.activity : {};
  const legacyCategory =
    typeof source.activity === "string" ? source.activity : activitySource.category;
  const category: ActivityCategory =
    legacyCategory === "productivity" || legacyCategory === "leisure" || legacyCategory === "idle"
      ? legacyCategory
      : "idle";
  const buildings = source.buildings.map((value, index) => {
    const building = isRecord(value) ? value : {};
    return {
      ...building,
      type: "building",
      id: typeof building.id === "string" ? building.id : `building-${index + 1}`,
      name: typeof building.name === "string" ? building.name : "Solar Workshop",
      variantId: typeof building.variantId === "string" ? building.variantId : "solar-workshop",
    };
  }) as Building[];
  const plants = source.plants.map((value, index) => {
    const plant = isRecord(value) ? value : {};
    const species = typeof plant.species === "string" ? plant.species : "broadleaf";
    return {
      ...plant,
      type: "plant",
      id: typeof plant.id === "string" ? plant.id : `plant-${index + 1}`,
      species,
      variantId: typeof plant.variantId === "string" ? plant.variantId : species,
    };
  }) as Plant[];
  const residents = source.residents.map((value, index) => {
    const resident = isRecord(value) ? value : {};
    return {
      ...resident,
      type: "resident",
      id: typeof resident.id === "string" ? resident.id : `resident-${index + 1}`,
    };
  }) as Resident[];

  const seed =
    isRecord(source.seed) && typeof source.seed.seed === "number"
      ? source.seed.seed
      : DEFAULT_WORLD_STATE.seed.seed;
  const grid = isRecord(source.grid) ? source.grid : {};
  const weather = isRecord(source.weather) ? source.weather : DEFAULT_WORLD_STATE.weather;
  const progression = isRecord(source.progression) ? source.progression : {};
  return {
    seed: { seed },
    grid: { ...DEFAULT_WORLD_STATE.grid, ...grid, width: 6, depth: 6 } as WorldState["grid"],
    buildings,
    plants,
    residents,
    weather: {
      condition:
        weather.condition === "cloudy" ||
        weather.condition === "rainy" ||
        weather.condition === "stormy"
          ? weather.condition
          : "sunny",
      updatedAt: typeof weather.updatedAt === "number" ? weather.updatedAt : Date.now(),
    },
    simulationTime: typeof source.simulationTime === "number" ? source.simulationTime : 0,
    activity: {
      category,
      productivityPoints:
        typeof activitySource.productivityPoints === "number"
          ? activitySource.productivityPoints
          : isRecord(source.progression) &&
              typeof source.progression.productivitySeconds === "number"
            ? source.progression.productivitySeconds
            : 0,
      leisurePoints:
        typeof activitySource.leisurePoints === "number"
          ? activitySource.leisurePoints
          : isRecord(source.progression) && typeof source.progression.leisureSeconds === "number"
            ? source.progression.leisureSeconds
            : 0,
      idlePoints:
        typeof activitySource.idlePoints === "number"
          ? activitySource.idlePoints
          : isRecord(source.progression) && typeof source.progression.idleSeconds === "number"
            ? source.progression.idleSeconds
            : 0,
    },
    lastActiveAt: typeof source.lastActiveAt === "number" ? source.lastActiveAt : Date.now(),
    progression: {
      unlockedBuildings: Array.isArray(progression.unlockedBuildings)
        ? progression.unlockedBuildings.filter((item): item is string => typeof item === "string")
        : [],
    },
  };
}

export async function initializeWorldPersistence(): Promise<void> {
  if (initialized) return;

  const api = window.edenAPI;
  const useBrowserStorage = !api;
  try {
    const savedValue = api ? await api.loadWorld() : localStorage.getItem(BROWSER_SAVE_KEY);
    if (savedValue) {
      const parsed =
        typeof savedValue === "string" ? (JSON.parse(savedValue) as unknown) : savedValue;
      const world = normalizeWorld(parsed);
      if (!world) throw new Error("Saved world has an unsupported format.");
      useWorldStore.getState().loadWorld(world);
    }
  } catch (error) {
    console.error("Failed to load saved world:", error);
    // Don't overwrite a save that failed to load or validate.
    return;
  }

  let saveQueue = Promise.resolve();
  useWorldStore.subscribe((state, previousState) => {
    if (state.world === previousState.world) return;
    const snapshot = structuredClone(state.world);
    saveQueue = saveQueue
      .catch(() => undefined)
      .then(async () => {
        if (api) await api.saveWorld(snapshot);
        else if (useBrowserStorage)
          localStorage.setItem(BROWSER_SAVE_KEY, JSON.stringify(snapshot));
      })
      .catch((error) => console.error("Failed to save world:", error));
  });

  initialized = true;
}
