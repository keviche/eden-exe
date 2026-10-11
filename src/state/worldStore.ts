import { create } from "zustand";
import type { ActivityCategory, Building, EntityId, Plant, Resident, Weather, WorldState } from "../simulation/types";
import { DEFAULT_WORLD_STATE, getCityDayKey, selectWeatherCondition } from "../simulation/worldDefaults";
import { BUILDING_CATALOG, findFreePlot, findFreePlantSite, GRID_SIZE, MAX_BUILDING_FLOORS } from "../edenModels";
import { findOpenResidentCell, findResidentPath, residentGridPosition, residentOccupiedPlots, residentWorldPosition } from "../simulation/navigation";

export const ACTIVITY_MILESTONE_POINTS = 5;
export const MAX_BUILDINGS = 80;
export const MAX_PLANTS = 180;
export const MAX_RESIDENTS = 40;
const IDLE_AFTER_MS = 60_000;
const ACTIVITY_KEY = { productivity: "productivityPoints", leisure: "leisurePoints", idle: "idlePoints" } as const;

interface WorldStore {
  world: WorldState;
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

const createId = (type: string) => `${type}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const freshWorld = (at = Date.now()): WorldState => {
  const world = structuredClone(DEFAULT_WORLD_STATE);
  const cityDayKey = getCityDayKey(new Date(at));
  return { ...world, cityDayKey, cycleStartedAt: at, lastActiveAt: at, weather: dailyWeather(cityDayKey, at) };
};

function createBuilding(world: WorldState, at: number): Building | null {
  if (world.buildings.length >= MAX_BUILDINGS) return null;
  const residents = residentOccupiedPlots(world.residents);
  const catalog = BUILDING_CATALOG;
  for (let attempt = 0; attempt < catalog.length; attempt++) {
    const config = catalog[Math.floor(Math.random() * catalog.length)]!;
    const plot = findFreePlot([...world.buildings, ...residents], world.plants, config.width, config.depth);
    if (!plot) return null;
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
  return { type: "plant", id: createId("plant"), species, variantId: species, gridPosition: position, growth: 0.7 + Math.random() * 0.3, createdAt: at };
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
        const plant = createPlant(world, at);
        if (plant) { world = { ...world, plants: [...world.plants, plant] }; changed = true; }
        if (earned >= 3 && world.buildings.some(building => (building.moss ?? 0) < 1)) {
          world = { ...world, buildings: world.buildings.map(building => ({ ...building, moss: Math.min(1, Math.max(building.moss ?? 0, (earned - 2) / 4)) })) };
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
  resetWorld: (at = Date.now()) => set({ world: freshWorld(at) }),
  loadWorld: world => set({ world: structuredClone(world) }),
  addBuilding: building => set(state => ({ world: { ...state.world, buildings: [...state.world.buildings, structuredClone(building)] } })),
  removeBuilding: id => set(state => ({ world: { ...state.world, buildings: state.world.buildings.filter(item => item.id !== id) } })),
  addPlant: plant => set(state => ({ world: { ...state.world, plants: [...state.world.plants, structuredClone(plant)] } })),
  removePlant: id => set(state => ({ world: { ...state.world, plants: state.world.plants.filter(item => item.id !== id) } })),
  addResident: resident => set(state => ({ world: { ...state.world, residents: [...state.world.residents, structuredClone(resident)] } })),
  removeResident: id => set(state => ({ world: { ...state.world, residents: state.world.residents.filter(item => item.id !== id) } })),
  setActivityCategory: (category, at = Date.now()) => set(state => ({ world: { ...state.world, activity: { ...state.world.activity, category }, lastActiveAt: at } })),
  recordInput: (at = Date.now()) => set(state => ({ world: { ...state.world, lastActiveAt: at, activity: { ...state.world.activity, category: state.world.activity.category === "idle" ? "productivity" : state.world.activity.category } } })),
  addActivityPoints: (category, points) => {
    if (!Number.isFinite(points) || points <= 0) return;
    set(state => ({ world: applyMilestones({ ...state.world, activity: { ...state.world.activity, [ACTIVITY_KEY[category]]: state.world.activity[ACTIVITY_KEY[category]] + points } }, Date.now()) }));
  },
  unlockBuilding: buildingType => set(state => state.world.progression.unlockedBuildings.includes(buildingType) ? state : { world: { ...state.world, progression: { ...state.world.progression, unlockedBuildings: [...state.world.progression.unlockedBuildings, buildingType] } } }),
  advanceTime: (seconds, at = Date.now()) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    set(state => {
      const dayKey = getCityDayKey(new Date(at));
      let world = state.world;
      if (world.cityDayKey !== dayKey) {
        world = { ...freshWorld(at), weather: dailyWeather(dayKey, at) };
      }
      const category = at - world.lastActiveAt >= IDLE_AFTER_MS ? "idle" : world.activity.category;
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
      return { world: applyMilestones(world, at) };
    });
  },
  setWeather: weather => set(state => ({ world: { ...state.world, weather: structuredClone(weather) } })),
}));

export const selectBuildings = (state: WorldStore) => state.world.buildings;
export const selectPlants = (state: WorldStore) => state.world.plants;
export const selectResidents = (state: WorldStore) => state.world.residents;
export const selectWeather = (state: WorldStore) => state.world.weather;
export const selectActivity = (state: WorldStore) => state.world.activity;
export const selectProgression = (state: WorldStore) => state.world.progression;
export const selectSimulationTime = (state: WorldStore) => state.world.simulationTime;
