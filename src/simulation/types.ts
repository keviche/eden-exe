<<<<<<< Updated upstream

/**
 * EDEN.EXE shared world types
 *
 * Coordinates use a right-handed 3D world:
 * X = left/right
 * Y = up/down
 * Z = forward/back
 *
 * Distances are measured in Three.js world units.
 *
 * Grid positions use integer cell coordinates.
 * Building grid positions refer to the anchor cell
 * at the minimum X/Z corner of their footprint.
 *
 * Rotations are measured in radians.
 * Timestamps are Unix milliseconds (Date.now()).
 * Entity IDs must be unique and stable across saves.
 */

// --------------------------------------------------
// Shared identifiers and coordinates
// --------------------------------------------------

=======
>>>>>>> Stashed changes
export type EntityId = string;
export type ActivityCategory = "productivity" | "leisure" | "idle";
export type ResidentActivity = "idle" | "walking" | "working" | "socializing" | "resting";

<<<<<<< Updated upstream
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
  width: number;
  depth: number;
  cellSize: number;
  origin: WorldPosition;
}

// --------------------------------------------------
// World generation
// --------------------------------------------------

export interface WorldSeed {
  seed: number;
}

// --------------------------------------------------
// Activity categories
// --------------------------------------------------

// What the user is doing on their computer.
export type ActivityCategory =
  | "productivity"
  | "leisure"
  | "idle";

// What an individual resident is doing in the world.
export type ResidentActivity =
  | "idle"
  | "walking"
  | "working"
  | "socializing"
  | "resting";

// Tracks accumulated activity points.
// The simulation determines how points are earned.
export interface ActivityState {
  category: ActivityCategory;
  productivityPoints: number;
  leisurePoints: number;
  idlePoints: number;
}

// --------------------------------------------------
// World entities
// --------------------------------------------------

=======
export interface GridPosition { x: number; z: number }
export interface WorldPosition { x: number; y: number; z: number }
export interface WorldGrid { width: number; depth: number; cellSize: number; origin: WorldPosition }
>>>>>>> Stashed changes
export interface Building {
  type: "building";
  id: EntityId;
  name: string;
<<<<<<< Updated upstream

  // Anchor cell at the minimum X/Z footprint corner.
  gridPosition: GridPosition;

  // Footprint measured in grid cells.
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
  gridPosition: GridPosition;
  growth: number;
  createdAt: number;
}

=======
  gridPosition: GridPosition;
  footprint: { width: number; depth: number };
  rotation: number;
  createdAt: number;
}
export interface Plant { id: EntityId; species: string; gridPosition: GridPosition; growth: number; createdAt: number }
>>>>>>> Stashed changes
export interface Resident {
  type: "resident";
  id: EntityId;
  name: string;
  position: WorldPosition;
  activity: ResidentActivity;
  createdAt: number;
}
<<<<<<< Updated upstream

// Discriminated union of all supported world entities.
export type WorldEntity = Building | Plant | Resident;

// --------------------------------------------------
// Weather and simulation
// --------------------------------------------------

export interface Weather {
  condition: "sunny" | "cloudy" | "rainy" | "stormy";
  updatedAt: number;
}

// --------------------------------------------------
// Progression
// --------------------------------------------------

export interface ProgressionState {
  // Building types that the user has unlocked.
  unlockedBuildings: string[];
}

// --------------------------------------------------
// Complete world state
// --------------------------------------------------

=======
export interface Weather { condition: "sunny" | "cloudy" | "rainy" | "stormy"; updatedAt: number }
export interface WorldSeed { seed: number }
>>>>>>> Stashed changes
export interface WorldState {
  seed: WorldSeed;
  grid: WorldGrid;

  buildings: Building[];
  plants: Plant[];
  residents: Resident[];

  weather: Weather;

  // Elapsed simulation time in seconds.
  simulationTime: number;
<<<<<<< Updated upstream

  // Computer activity and earned growth resources.
  activity: ActivityState;

  // Unlocked content and progression.
  progression: ProgressionState;
=======
  activity: ActivityCategory;
  lastActiveAt: number;
  progression: { productivitySeconds: number; leisureSeconds: number; idleSeconds: number };
>>>>>>> Stashed changes
}
