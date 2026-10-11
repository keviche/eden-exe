/** Shared simulation and persistence types. Grid positions are zero-based cells. */
export type EntityId = string;
export type EntityType = "building" | "plant" | "resident";
export type ActivityCategory = "productivity" | "leisure" | "idle";
export type ResidentActivity = "idle" | "walking" | "working" | "socializing" | "resting";

export interface GridPosition {
  x: number;
  z: number;
}
export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}
export type Vector3 = WorldPosition;
export interface WorldGrid {
  readonly width: 6;
  readonly depth: 6;
  cellSize: number;
  origin: WorldPosition;
}
export interface WorldSeed {
  seed: number;
}

export type BuildingKind =
  | "house"
  | "workshop"
  | "school"
  | "library"
  | "restaurant"
  | "cafe"
  | "arcade"
  | "recreation-center";
export interface Building {
  type: "building";
  id: EntityId;
  name: string;

  /** Stable key used to select this building's visual variant. */
  variantId: string;

  /** Building category, such as house, school, or restaurant. */
  kind?: BuildingKind;

  /** Architectural development level, from 1 to 5. */
  level?: number;

  /** Vegetation coverage, from 0 to 1. */
  natureGrowth?: number;

  /** Anchor cell at the minimum X/Z footprint corner. */
  gridPosition: GridPosition;

  footprint: {
    width: number;
    depth: number;
  };

  rotation: number;
  createdAt: number;
}
export interface Plant {
  type: "plant";
  id: EntityId;
  species: string;
  variantId: string;
  gridPosition: GridPosition;
  growth: number;
  createdAt: number;
}
export interface Resident {
  type: "resident";
  id: EntityId;
  name: string;
  position: WorldPosition;
  activity: ResidentActivity;
  createdAt: number;
}
export type WorldEntity = Building | Plant | Resident;

export interface Weather {
  condition: "sunny" | "cloudy" | "rainy" | "stormy";
  updatedAt: number;
}
export interface ActivityState {
  category: ActivityCategory;
  /** Accumulated active seconds by category. */
  productivityPoints: number;
  leisurePoints: number;
  idlePoints: number;
}
export interface ProgressionState {
  unlockedBuildings: string[];
}
export interface WorldState {
  seed: WorldSeed;
  grid: WorldGrid;
  buildings: Building[];
  plants: Plant[];
  residents: Resident[];
  weather: Weather;
  simulationTime: number;
  activity: ActivityState;
  lastActiveAt: number;
  progression: ProgressionState;
}
