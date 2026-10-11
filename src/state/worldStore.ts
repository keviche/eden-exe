import { create } from "zustand";
import type { ActivityCategory, Building, EntityId, Plant, Resident, Weather, WorldState } from "../simulation/types";
import { DEFAULT_WORLD_STATE, getCityDayKey, selectWeatherCondition } from "../simulation/worldDefaults";
import { BUILDING_CATALOG, findFreePlot, findFreePlantSite, GRID_SIZE, MAX_BUILDING_FLOORS } from "../edenModels";
import { findOpenResidentCell, findResidentPath, residentGridPosition, residentOccupiedPlots, residentWorldPosition } from "../simulation/navigation";

export const ACTIVITY_MILESTONE_POINTS = 5;
export const MAX_NATURE_GROWTH = 3;
export const NATURE_GROWTH_PER_POINT = 0.12;
export const MOSS_GROWTH_PER_POINT = 0.035;

export const MAX_BUILDINGS = 80;
export const MAX_PLANTS = 180;
export const MAX_RESIDENTS = 40;
const ACTIVITY_KEY = { productivity: "productivityPoints", leisure: "leisurePoints", idle: "idlePoints" } as const;

type NonIdleCategory = "productivity" | "leisure";

interface WorldStore {
  world: WorldState;

  systemIdle: boolean;
  lastNonIdleCategory: NonIdleCategory;
  setSystemIdle: (idle: boolean) => void;

  resetWorld: (at?: number) => void;
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

const freshWorld = (at = Date.now()): WorldState => ({
  ...structuredClone(DEFAULT_WORLD_STATE),
  cityDayKey: getCityDayKey(new Date(at)),
  waterSeed: Math.floor(Math.random() * 4294967295) + 1,
});

const getNonIdleCategory = (
  category: ActivityCategory,
  fallback: NonIdleCategory = "productivity"
): NonIdleCategory =>
  category === "productivity" || category === "leisure"
    ? category
    : fallback;

const createId = (type: string) =>
  `${type}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function createBuilding(world: WorldState, at: number): Building | null {
  if (world.buildings.length >= MAX_BUILDINGS) return null;
  const residents = residentOccupiedPlots(world.residents);
  // Let the growing city feel cottage-scale and garden-led while keeping every
  // existing building type available to the simulation.
  const catalog: (typeof BUILDING_CATALOG)[number][] = [];
  for (const entry of BUILDING_CATALOG) {
    const copies = entry.id === "solar-house" ? 4 : entry.id === "greenhouse" ? 2 : 1;
    for (let copy = 0; copy < copies; copy++) catalog.push(entry);
  }
  for (let attempt = 0; attempt < catalog.length; attempt++) {
    const config = catalog[Math.floor(Math.random() * catalog.length)]!;
    const plot = findFreePlot([...world.buildings, ...residents], world.plants, config.width, config.depth);
    if (!plot) continue;
    return { type: "building", id: createId("building"), name: config.name, variantId: config.id, gridPosition: plot, footprint: { width: config.width, depth: config.depth }, rotation: 0, floors: Math.min(config.floors, MAX_BUILDING_FLOORS), moss: 0, createdAt: at };
  }
  return null;
}

function createPlant(world: WorldState, at: number): Plant | null {
  if (world.plants.length >= MAX_PLANTS) return null;
  // Randomized candidates keep free navigation corridors around structures.
  const residents = residentOccupiedPlots(world.residents);
  const position = findFreePlantSite([...world.buildings, ...world.plants, ...residents]);
  if (!position) return null;
  const species = (["tree", "shrub", "fern", "flower", "grass"] as const)[Math.floor(Math.random() * 5)]!;
  return { type: "plant", id: createId("plant"), species, variantId: species, gridPosition: position, growth: 0.2 + Math.random() * 0.35, createdAt: at };
}


const EDEN_GROWTH_MAX = 3;

function edenRandom(id: string, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function growEden(world: WorldState, points: number): WorldState {
  if (points <= 0) return world;

  return {
    ...world,
    buildings: world.buildings.map(building => {
      const speed = 0.65 + edenRandom(building.id, 7) * 0.7;
      return {
        ...building,
        moss: Math.min(
          1,
          (building.moss ?? 0) + points * 0.025 * speed
        ),
      };
    }),
    plants: world.plants.map(plant => {
      const speed = 0.65 + edenRandom(plant.id, 13) * 0.7;
      const maxGrowth =
        1.4 + edenRandom(plant.id, 29) * 1.6;

      return {
        ...plant,
        growth: Math.min(
          Math.min(EDEN_GROWTH_MAX, maxGrowth),
          plant.growth + points * 0.075 * speed
        ),
      };
    }),
  };
}

function applyMilestones(worldInput: WorldState, at: number): WorldState {
  let world = worldInput;
  const consumedMilestones = { ...world.progression.consumedMilestones };
  for (const category of ["productivity", "leisure", "idle"] as const) {
    const total = world.activity[ACTIVITY_KEY[category]];
    const earned = Math.floor(total / ACTIVITY_MILESTONE_POINTS);
    let consumed = consumedMilestones[category];
    while (consumed < earned) {
      let changed = false;
      if (category === "productivity") {
        const eligible = world.buildings.find(building => (building.floors ?? 1) < MAX_BUILDING_FLOORS);
        if (eligible) {
          world = { ...world, buildings: world.buildings.map(building => building.id === eligible.id ? { ...building, floors: Math.min(MAX_BUILDING_FLOORS, (building.floors ?? 1) + 1), growth: 1 } : building) };
          changed = true;
        } else {
          const building = createBuilding(world, at);
          if (building) { world = { ...world, buildings: [...world.buildings, building] }; changed = true; }
        }
      } else if (category === "leisure") {
        const buildingCount = world.buildings.length;
        const treeCount = world.plants.filter(
          plant => plant.species === "tree"
        ).length;

        // Roughly 1 tree per building, with some variation.
        const maxTrees = Math.max(
          1,
          Math.ceil(buildingCount * 1.2)
        );

        // Limit total nature so buildings remain visually prominent.
        const maxNature = Math.max(
          2,
          Math.ceil(buildingCount * 1.8)
        );

        if (world.plants.length < maxNature) {
          let plant = createPlant(world, at);

          if (plant) {
            if (
              plant.species === "tree" &&
              treeCount >= maxTrees
            ) {
              const alternatives = [
                "shrub",
                "fern",
                "flower",
                "grass",
              ] as const;

              const species =
                alternatives[
                  Math.floor(Math.random() * alternatives.length)
                ]!;

              plant = {
                ...plant,
                species,
                variantId: species,
              };
            }

            world = {
              ...world,
              plants: [...world.plants, plant],
            };

            changed = true;
          }
        }

        // Existing buildings continue developing moss and vines.
        if (
          earned >= 3 &&
          world.buildings.some(
            building => (building.moss ?? 0) < 1
          )
        ) {
          world = {
            ...world,
            buildings: world.buildings.map(building => ({
              ...building,
              moss: Math.min(
                1,
                Math.max(
                  building.moss ?? 0,
                  (earned - 2) / 4
                )
              ),
            })),
          };

          changed = true;
        }

      } else if (world.residents.length < MAX_RESIDENTS) {
        const cell = findOpenResidentCell(world.buildings, world.plants, world.residents.map(resident => resident.position));
        if (!cell) break;
        const building = world.buildings[Math.floor(Math.random() * Math.max(1, world.buildings.length))];
        const resident: Resident = { type: "resident", id: createId("resident"), name: `Resident ${world.residents.length + 1}`, position: residentWorldPosition(cell), activity: "walking", homeId: building?.id, route: [], createdAt: at };
        world = { ...world, residents: [...world.residents, resident] }; changed = true;
      }
      if (!changed) break;
      consumed++;
    }
    consumedMilestones[category] = consumed;
  }
  return { ...world, progression: { ...world.progression, consumedMilestones } };
}

function dailyWeather(dayKey: string, at: number): Weather {
  return { condition: selectWeatherCondition(), updatedAt: at, cityDayKey: dayKey };
}

export const useWorldStore = create<WorldStore>((set) => ({
  world: freshWorld(),

  // --------------------------------------------------
  // System-wide idle monitoring
  // --------------------------------------------------

  systemIdle: false,
  lastNonIdleCategory: getNonIdleCategory(
    DEFAULT_WORLD_STATE.activity.category
  ),

  setSystemIdle: (idle) =>
    set((state) => {
      if (state.systemIdle === idle) {
        return state;
      }

      const previousCategory = getNonIdleCategory(
        state.world.activity.category,
        state.lastNonIdleCategory
      );

      return {
        systemIdle: idle,
        lastNonIdleCategory: previousCategory,
        world: {
          ...state.world,
          lastActiveAt: idle
            ? state.world.lastActiveAt
            : Date.now(),
          activity: {
            ...state.world.activity,
            category: idle ? "idle" : previousCategory,
          },
        },
      };
    }),

  // --------------------------------------------------
  // World persistence
  // --------------------------------------------------

  resetWorld: (at = Date.now()) =>
    set((state) => {
      const world = freshWorld(at);
      const lastNonIdleCategory = getNonIdleCategory(
        world.activity.category
      );

      if (state.systemIdle) {
        world.activity.category = "idle";
      }

      return { world, lastNonIdleCategory };
    }),

  loadWorld: (savedWorld) =>
    set((state) => {
      const world = structuredClone(savedWorld);
      const lastNonIdleCategory = getNonIdleCategory(
        world.activity.category,
        state.lastNonIdleCategory
      );

      if (state.systemIdle) {
        world.activity.category = "idle";
      } else if (world.activity.category === "idle") {
        world.activity.category = lastNonIdleCategory;
      }

      return { world, lastNonIdleCategory };
    }),

  // --------------------------------------------------
  // Buildings
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Plants
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Residents
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Activity category
  // --------------------------------------------------

  setActivityCategory: (category, at = Date.now()) =>
    set((state) => {
      const lastNonIdleCategory = getNonIdleCategory(
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
            category: state.systemIdle ? "idle" : category,
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
            : getNonIdleCategory(
                state.world.activity.category,
                state.lastNonIdleCategory
              ),
        },
      },
    })),

  addActivityPoints: (category, points) => {
    if (!Number.isFinite(points) || points <= 0) return;

    set(state => {
      let world = applyMilestones({
        ...state.world,
        activity: {
          ...state.world.activity,
          [ACTIVITY_KEY[category]]:
            state.world.activity[ACTIVITY_KEY[category]] + points,
        },
      }, Date.now());

      world = growEden(world, points);

      return { world };
    });
  },

  // --------------------------------------------------
  // Progression
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Simulation timer
  // --------------------------------------------------

  advanceTime: (seconds, at = Date.now()) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    set(state => {
      const dayKey = getCityDayKey(new Date(at));
      let world = state.world;
      if (world.cityDayKey !== dayKey) {
        world = { ...freshWorld(at), weather: dailyWeather(dayKey, at) };
      }

      // Electron determines whether the system is idle.
      // Otherwise, use the selected productivity/leisure/idle category.
      const category: ActivityCategory = state.systemIdle ? "idle" : world.activity.category;

      world = { ...world, simulationTime: world.simulationTime + seconds, activity: { ...world.activity, category, [ACTIVITY_KEY[category]]: world.activity[ACTIVITY_KEY[category]] + seconds / 60 } };
      if (world.residents.length) {
        const isNight = world.simulationTime % 600 >= 360;
        world = { ...world, residents: world.residents.map(resident => {
          if (isNight) {
            const home = world.buildings.find(building => building.id === resident.homeId);
            const homePosition = home ? {
              x: (home.gridPosition.x + home.footprint.width / 2 - GRID_SIZE / 2) * 2,
              y: 0,
              z: (home.gridPosition.z + home.footprint.depth / 2 - GRID_SIZE / 2) * 2,
            } : resident.position;
            return { ...resident, activity: "resting", position: homePosition, route: [] };
          }
          let route = resident.route ?? [];
          if (!route.length) {
            const target = findOpenResidentCell(world.buildings, world.plants, world.residents.map(other => other.position));
            if (target) route = findResidentPath(residentGridPosition(resident.position), target, world.buildings, world.plants) ?? [];
          }
          const nextCell = route[0];
          if (!nextCell) return { ...resident, activity: "walking", route: [] };
          const target = residentWorldPosition(nextCell);
          const dx = target.x - resident.position.x, dz = target.z - resident.position.z, distance = Math.hypot(dx, dz);
          const step = Math.min(distance, Math.min(seconds, 2) * 0.35);
          if (distance <= step + 0.01) return { ...resident, activity: "walking", position: target, route: route.slice(1) };
          return { ...resident, activity: "walking", route, position: { ...resident.position, x: resident.position.x + dx / distance * step, z: resident.position.z + dz / distance * step } };
        }) };
      }

      world = growEden(applyMilestones(world, at), seconds / 60);

      return { world };
    });
  },

  // --------------------------------------------------
  // Weather
  // --------------------------------------------------

  setWeather: weather => set(state => ({
      world: {
        ...state.world,
        weather: structuredClone(weather),
      },
    })),
}));

// --------------------------------------------------
// Selectors
// --------------------------------------------------

export const selectBuildings = (state: WorldStore) => state.world.buildings;
export const selectPlants = (state: WorldStore) => state.world.plants;
export const selectResidents = (state: WorldStore) => state.world.residents;
export const selectWeather = (state: WorldStore) => state.world.weather;
export const selectActivity = (state: WorldStore) => state.world.activity;
export const selectProgression = (state: WorldStore) => state.world.progression;
export const selectSimulationTime = (state: WorldStore) => state.world.simulationTime;