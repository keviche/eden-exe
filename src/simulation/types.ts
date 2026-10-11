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
  readonly width: 20;
  readonly depth: 20;
  cellSize: number;
  origin: WorldPosition;
}
export interface Building {
  type: "building";
  id: EntityId;
  name: string;
  /** Stable key used to select this building's visual variant. */
  variantId: string;
  /** Anchor cell at the minimum X/Z footprint corner. */
  gridPosition: GridPosition;
  footprint: { width: number; depth: number };
  rotation: number;
  floors?: number;
  moss?: number;
  growth?: number;
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
  homeId?: EntityId;
  route?: GridPosition[];
  createdAt: number;
}
export type WorldEntity = Building | Plant | Resident;

export interface Weather {
  condition: "sunny" | "cloudy" | "rainy";
  updatedAt: number;
  cityDayKey?: string;
}
export interface ActivityState {
  category: ActivityCategory;
  /** Accumulated activity minutes by category. */
  productivityPoints: number;
  leisurePoints: number;
  idlePoints: number;

  /** Successful clicks on bubbles during the current city day. */
  bubblePops?: number;
}
export interface ProgressionState {
  unlockedBuildings: string[];
  consumedMilestones: Record<ActivityCategory, number>;
}
export interface WorldState {
  /** Procedural water layout seed. */
  waterSeed?: number;
  grid: WorldGrid;
  buildings: Building[];
  plants: Plant[];
  residents: Resident[];
  weather: Weather;
  simulationTime: number;
  activity: ActivityState;
  lastActiveAt: number;
  progression: ProgressionState;
  cityDayKey: string;
  cycleStartedAt: number;
}
