
/**
 * Coordinates use a right-handed 3D world:
 * X = left/right
 * Y = up/down
 * Z = forward/back
 *
 * Distances are measured in world units.
 * Entity positions refer to their center unless
 * a particular entity type documents otherwise.
 */

export type EntityId = string;

// Discrete grid coordinates: whole-number cell positions.
export interface GridPosition {
  x: number;
  z: number;
}

// Continuous Three.js coordinates.
export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

export interface WorldGrid {
  width: number;       // Number of cells along X
  depth: number;       // Number of cells along Z
  cellSize: number;    // World units per cell
  origin: WorldPosition;
}

export interface Building {
  id: EntityId;
  name: string;

  // Location of the building's anchor cell.
  gridPosition: GridPosition;

  // Footprint measured in grid cells.
  footprint: {
    width: number;
    depth: number;
  };

  // Full 360 degree rotation
  rotation: number;

  createdAt: number;
}

export interface Plant {
  id: EntityId;
  species: string;
  gridPosition: GridPosition;
  growth: number;
  createdAt: number;
}

export interface WorldState {
  seed: WorldSeed;
  grid: WorldGrid;
  buildings: Building[];
  plants: Plant[];
  residents: Resident[];
  weather: Weather;
  simulationTime: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type ResidentActivity=
  | "idle"
  | "walking"
  | "working"
  | "socializing"
  | "resting";

export type ActivityCategory =
    | "productivity"
    | "leisure"
    | "idle"

export interface Resident {
  id: EntityId;
  name: string;
  position: Vector3;
  activity: ResidentActivity;
  createdAt: number;
}

export interface Weather {
  condition: "sunny" | "cloudy" | "rainy" | "stormy";
  updatedAt: number;
}

export interface WorldSeed {
  seed: number;
}

export interface WorldEntity {
  id: EntityId;
  type: "building" | "plant" | "resident";
}

export interface WorldState {
  seed: WorldSeed;
  grid: WorldGrid;
  buildings: Building[];
  plants: Plant[];
  residents: Resident[];
  weather: Weather;
  simulationTime: number;
}
