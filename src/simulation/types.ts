<<<<<<< HEAD
<<<<<<< Updated upstream

=======
>>>>>>> e5afd0290edbd060866f11d175a7082dc0b73ce3
/**
 * EDEN.EXE shared world types
 *
 * Coordinate conventions:
 * - X = left/right
 * - Y = vertical
 * - Z = forward/back
 * - The usable world surface is flat.
 * - Grid coordinates are integer cell coordinates.
 * - The world contains exactly 6 columns and 6 rows.
 * - Building positions identify the anchor cell at the
 *   minimum X/Z corner of their footprint.
 *
 * Rotations are measured in radians.
 * Timestamps are Unix milliseconds.
 * Entity IDs are unique, stable GUIDs.
 */

// --------------------------------------------------
// Shared identifiers and coordinates
// --------------------------------------------------

=======
>>>>>>> Stashed changes
export type EntityId = string;
export type ActivityCategory = "productivity" | "leisure" | "idle";
export type ResidentActivity = "idle" | "walking" | "working" | "socializing" | "resting";

<<<<<<< HEAD
<<<<<<< Updated upstream
=======
export type EntityType = "building" | "plant" | "resident";

>>>>>>> e5afd0290edbd060866f11d175a7082dc0b73ce3
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

// The world always uses a 6x6 grid.
export interface WorldGrid {
  readonly width: 6;
  readonly depth: 6;
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

export type ActivityCategory =
  | "productivity"
  | "leisure"
  | "idle";

export type ResidentActivity =
  | "idle"
  | "walking"
  | "working"
  | "socializing"
  | "resting";

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

  // Unique identifier for the saved procedural appearance.
  // The same variant can be shared by multiple buildings.
  variantId: string;

  // Anchor cell at the minimum X/Z footprint corner.
  gridPosition: GridPosition;

  // Footprint measured in grid cells.
  footprint: {
    width: number;
    depth: number;
  };

  // Rotation around the vertical Y axis, in radians.
  rotation: number;

  createdAt: number;
}

export interface Plant {
  type: "plant";
  id: EntityId;
  species: string;

  // Saved visual variant for consistent rendering.
  variantId: string;

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
<<<<<<< HEAD
  position: WorldPosition;
=======

  // Residents use world coordinates for movement.
  // Keep their Y position on the flat world surface.
  position: Vector3;

>>>>>>> e5afd0290edbd060866f11d175a7082dc0b73ce3
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
<<<<<<< HEAD
=======
  activity: ActivityCategory;
  lastActiveAt: number;
  progression: { productivitySeconds: number; leisureSeconds: number; idleSeconds: number };
>>>>>>> Stashed changes
}
=======
}
>>>>>>> e5afd0290edbd060866f11d175a7082dc0b73ce3
