/** Shared renderer configuration and pure procedural models. No React/Three imports. */
export const GRID_SIZE = 20;
export const CELL_SIZE = 1.5;
export const BOARD_SIZE = GRID_SIZE * CELL_SIZE;
export const BUILDING_GROWTH_SECONDS = 300;
export const GROWTH_REFRESH_MS = 2_000;
export const MAX_BUILDING_FLOORS = 5;

export type Vec3 = [number, number, number];
export type Matrix = number[];
export type Shape = "box" | "sphere" | "leaf" | "foliage" | "roof" | "gable" | "cone" | "cylinder" | "stem" | "capsule";
export type Finish = "matte" | "glass" | "greenhouse" | "solar" | "metal";
export type Part = { shape: Shape; finish: Finish; color: string; matrix: Matrix };
export type Model = readonly Part[];
export type GrowthSource = { createdAt: number; growth?: number };
export type Plot = {
  gridPosition: {
    x: number;
    z: number;
  };
  footprint?: {
    width: number;
    depth: number;
  };
  species?: "tree" | "shrub" | "fern" | "flower" | "grass";
};

export type ResidentCoordinates = "legacy-centered" | "grid" | "world";
// Matches the supplied ResidentMesh. Set to "grid" if residents use grid coordinates.
export const RESIDENT_COORDINATES: ResidentCoordinates = "legacy-centered";

export const BUILDING_CATALOG = [
  { id: "solar-house", name: "Solar House", width: 2, depth: 2, floors: 2 },
  { id: "solar-workshop", name: "Solar Workshop", width: 3, depth: 2, floors: 3 },
  { id: "greenhouse", name: "Greenhouse", width: 3, depth: 2, floors: 1 },
  { id: "eco-apartments", name: "Eco Apartments", width: 2, depth: 2, floors: 4 },
  { id: "community-library", name: "Community Library", width: 3, depth: 2, floors: 2 },
  { id: "wind-tower", name: "Wind Tower", width: 2, depth: 2, floors: 3 },
  { id: "garden-pavilion", name: "Garden Pavilion", width: 2, depth: 2, floors: 1 },
  { id: "rooftop-farm", name: "Rooftop Farm", width: 3, depth: 2, floors: 2 },
] as const;
export type BuildingVariant = (typeof BUILDING_CATALOG)[number]["id"];
export type PlantSpecies = "fern" | "flower" | "shrub" | "tree" | "grass";

export function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function hashId(id: string | number) {
  let hash = 2166136261;
  for (const character of String(id)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

export function cellPoint(x: number, z: number) {
  return { x: (x + 0.5 - GRID_SIZE / 2) * CELL_SIZE, z: (z + 0.5 - GRID_SIZE / 2) * CELL_SIZE };
}

export function buildingDimensions(footprint: { width: number; depth: number }, rotation: number) {
  const quarterTurn = Math.abs(Math.round(rotation / (Math.PI / 2))) % 2 === 1;
  const columns = quarterTurn ? footprint.depth : footprint.width;
  const rows = quarterTurn ? footprint.width : footprint.depth;
  return { width: Math.max(0.8, columns * CELL_SIZE - 0.35), depth: Math.max(0.8, rows * CELL_SIZE - 0.5) };
}

export function residentPoint(x: number, z: number, mode: ResidentCoordinates = RESIDENT_COORDINATES) {
  switch (mode) {
    case "grid": return cellPoint(x, z);
    case "world": return { x, z };
    default: return { x: x * CELL_SIZE / 2, z: z * CELL_SIZE / 2 };
  }
}

export function hasExplicitGrowth(item: GrowthSource) {
  return typeof item.growth === "number" && Number.isFinite(item.growth);
}

export function buildingProgress(item: GrowthSource, now: number) {
  if (hasExplicitGrowth(item)) return clamp01(item.growth!);
  if (!Number.isFinite(item.createdAt)) return 1;
  return clamp01((now - item.createdAt) / (BUILDING_GROWTH_SECONDS * 1_000));
}

export function growthStage(progress: number): 0 | 1 | 2 {
  return progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2;
}

/** Column-major matrices, matching Three.js Matrix4.fromArray(). */
export function compose(position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): Matrix {
  const [rx, ry, rz] = rotation.map(value => value / 2);
  const c1 = Math.cos(rx!), c2 = Math.cos(ry!), c3 = Math.cos(rz!);
  const s1 = Math.sin(rx!), s2 = Math.sin(ry!), s3 = Math.sin(rz!);
  const x = s1 * c2 * c3 + c1 * s2 * s3;
  const y = c1 * s2 * c3 - s1 * c2 * s3;
  const z = c1 * c2 * s3 + s1 * s2 * c3;
  const w = c1 * c2 * c3 - s1 * s2 * s3;
  const xx = 2 * x * x, yy = 2 * y * y, zz = 2 * z * z;
  const xy = 2 * x * y, xz = 2 * x * z, yz = 2 * y * z;
  const wx = 2 * w * x, wy = 2 * w * y, wz = 2 * w * z;
  return [
    (1 - yy - zz) * scale[0], (xy + wz) * scale[0], (xz - wy) * scale[0], 0,
    (xy - wz) * scale[1], (1 - xx - zz) * scale[1], (yz + wx) * scale[1], 0,
    (xz + wy) * scale[2], (yz - wx) * scale[2], (1 - xx - yy) * scale[2], 0,
    position[0], position[1], position[2], 1,
  ];
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      out[column * 4 + row] = a[row]! * b[column * 4]! + a[row + 4]! * b[column * 4 + 1]!
        + a[row + 8]! * b[column * 4 + 2]! + a[row + 12]! * b[column * 4 + 3]!;
    }
  }
  return out;
}

class Builder {
  parts: Part[] = [];
  private transform = compose();

  add(shape: Shape, position: Vec3, scale: Vec3, color: string, rotation: Vec3 = [0, 0, 0], finish: Finish = "matte") {
    this.parts.push({ shape, finish, color, matrix: multiply(this.transform, compose(position, rotation, scale)) });
  }
  box(size: Vec3, at: Vec3, color: string, rotation: Vec3 = [0, 0, 0], finish: Finish = "matte") {
    this.add("box", at, size, color, rotation, finish);
  }
  group(at: Vec3, rotation: Vec3, scale: Vec3, build: () => void) {
    const parent = this.transform;
    this.transform = multiply(parent, compose(at, rotation, scale));
    try { build(); } finally { this.transform = parent; }
  }
  stem(start: Vec3, end: Vec3, radius = 0.012, color = "#54804d") {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
    const length = Math.hypot(dx, dy, dz);
    if (length < 0.0001) return;
    this.group([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2], [0, Math.atan2(dx, dz), 0], [1, 1, 1], () => {
      this.add("stem", [0, 0, 0], [radius, length, radius], color, [Math.atan2(Math.hypot(dx, dz), dy), 0, 0]);
    });
  }
  leaf(at: Vec3, rotation: Vec3, length = 0.2, width = 0.07, color = "#66aa68") {
    this.add("leaf", at, [width / 2, length / 2, 0.012], color, rotation);
  }
  foliage(at: Vec3, radius: number, color = "#75aa68") {
    this.add("foliage", at, [radius, radius * 0.9, radius], color);
  }
}

function planter(b: Builder, at: Vec3, size = 0.18) {
  b.group(at, [0, 0, 0], [size, size, size], () => {
    b.box([1, 0.65, 1], [0, 0.325, 0], "#c58d68");
    b.box([1.12, 0.14, 1.12], [0, 0.65, 0], "#dfb18b");
    b.foliage([-0.2, 1.02, 0], 0.64, "#4f9d68");
    b.foliage([0.2, 1.05, 0.1], 0.6, "#82bf76");
  });
}

function solarPanel(b: Builder, at: Vec3, width: number, depth: number, tilt = 0.22) {
  b.group(at, [tilt, 0, 0], [1, 1, 1], () => {
    b.box([width, 0.035, depth], [0, 0, 0], "#dce8df", [0, 0, 0], "metal");
    b.box([width - 0.035, 0.01, depth - 0.035], [0, 0.024, 0], "#087fa8", [0, 0, 0], "solar");
    b.box([0.012, 0.006, depth - 0.035], [0, 0.032, 0], "#d6fbff");
    b.box([width - 0.035, 0.006, 0.012], [0, 0.032, 0], "#d6fbff");
  });
}

function windowPane(b: Builder, at: Vec3, yaw: number, width = 0.34, height = 0.36) {
  b.group(at, [0, yaw, 0], [1, 1, 1], () => {
    b.box([width + 0.065, height + 0.065, 0.04], [0, 0, 0], "#f4d693");
    b.box([width, height, 0.012], [0, 0, 0.027], "#70e5f3", [0, 0, 0], "glass");
    b.box([0.018, height, 0.018], [0, 0, 0.038], "#fff2cb");
    b.box([width + 0.1, 0.035, 0.095], [0, -height / 2 - 0.03, 0.015], "#fff2cb");
  });
}

function facade(b: Builder, width: number, depth: number, floors: number, floorHeight: number, wallColor: string, base = 0.12) {
  const height = floors * floorHeight;
  b.box([width, height, depth], [0, base + height / 2, 0], wallColor);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    b.box([0.05, height, 0.05], [x * width / 2, base + height / 2, z * depth / 2], "#f1ecdc");
  }
  const columns = Math.max(2, Math.min(4, Math.floor(width / 0.65)));
  const sideColumns = Math.max(1, Math.min(3, Math.floor(depth / 0.65)));
  for (let floor = 0; floor < floors; floor++) {
    const y = base + floor * floorHeight + floorHeight * 0.69;
    for (let column = 0; column < columns; column++) {
      const x = (column - (columns - 1) / 2) * width / (columns + 0.7);
      if (floor > 0 || Math.abs(x) > 0.42) windowPane(b, [x, y, depth / 2 + 0.012], 0);
      windowPane(b, [x, y, -depth / 2 - 0.012], Math.PI);
    }
    for (let column = 0; column < sideColumns; column++) {
      const z = (column - (sideColumns - 1) / 2) * depth / (sideColumns + 0.7);
      for (const side of [-1, 1]) windowPane(b, [side * (width / 2 + 0.012), y, z], side * Math.PI / 2);
    }
    if (floor > 0) b.box([width + 0.04, 0.045, depth + 0.04], [0, base + floor * floorHeight, 0], "#ecedda");
  }
  return base + height;
}

function entrance(b: Builder, width: number, depth: number, stage: number) {
  const front = depth / 2;
  b.box([0.48, 0.76, 0.05], [0, 0.48, front + 0.025], "#9c583b");
  b.box([0.37, 0.66, 0.025], [0, 0.44, front + 0.06], "#d99c62");
  b.add("sphere", [0, 0.83, front + 0.044], [0.27, 0.27, 0.055], "#fff0c1");
  b.add("sphere", [0, 0.84, front + 0.093], [0.205, 0.21, 0.022], "#ffc96b", [0, 0, 0], "glass");
  b.box([0.22, 0.27, 0.015], [0, 0.54, front + 0.112], "#fff0a7", [0, 0, 0], "glass");
  b.add("sphere", [0.12, 0.4, front + 0.13], [0.02, 0.02, 0.02], "#f7d269", [0, 0, 0], "metal");
  b.box([0.62, 0.055, 0.28], [0, 0.91, front + 0.08], "#f0c176");
  b.box([0.6, 0.12, 0.22], [0, 0.06, front + 0.09], "#fff1cd");
  if (stage > 0) for (const side of [-1, 1]) planter(b, [side * width * 0.36, 0, front + 0.1], 0.17);
}

function flatRoof(b: Builder, width: number, depth: number, y: number) {
  b.box([width + 0.14, 0.08, depth + 0.14], [0, y + 0.02, 0], "#fff1c4");
  b.box([width, 0.045, depth], [0, y + 0.08, 0], "#69c65c");
  for (const side of [-1, 1]) {
    b.box([width + 0.12, 0.1, 0.06], [0, y + 0.11, side * (depth / 2 + 0.025)], "#fff0bf");
    b.box([0.06, 0.1, depth + 0.1], [side * (width / 2 + 0.025), y + 0.11, 0], "#fff0bf");
  }
}

function addMoss(b: Builder, width: number, depth: number, y: number, amount: number, seed: number) {
  const patches = Math.min(5, Math.ceil(clamp01(amount) * 5));
  for (let patch = 0; patch < patches; patch++) {
    const x = ((patch * 37 + seed) % 7 - 3) * width / 8;
    const z = ((patch * 19 + seed) % 7 - 3) * depth / 8;
    b.foliage([x, y + 0.07, z], 0.12 + (patch % 2) * 0.035, patch % 2 ? "#6d9d69" : "#82ae70");
  }
}

function buildBuilding(variant: string, width: number, depth: number, stage: number, seed: number, floorsOverride?: number, moss = 0): Model {
  const b = new Builder();
  const base = 0.12;
  const floorHeight = 0.78;
  const config = BUILDING_CATALOG.find(entry => entry.id === variant) ?? BUILDING_CATALOG[0];
  const floors = Math.min(MAX_BUILDING_FLOORS, Math.max(1, Math.round(floorsOverride ?? (1 + (config.floors - 1) * stage / 2))));
  
  // Foundation pad
  b.box([width + 0.1, base, depth + 0.1], [0, base / 2, 0], "#acb6a4");

  // --- GLASS-HEAVY STREAMLINE MODERNE WITH TOP GLASS DOME FOR SOLAR HOUSE ---
  if (variant === "solar-house") {
    const radius = Math.min(width, depth) * 0.38;
    
    // Floors stack upward from the ground, keeping the dome permanently on top
    for (let floor = 0; floor < floors; floor++) {
      const y = base + floor * floorHeight;

      // Main structural body made of transparent glass
      b.add("cylinder", [0, y + floorHeight / 2, 0], [radius, floorHeight, radius], "#70e5f3", [0, 0, 0], "glass");
      
      // Teal tile wainscoting band around the bottom of each floor
      b.add("cylinder", [0, y + 0.10, 0], [radius * 1.01, 0.20, radius * 1.01], "#35a79c");
      b.add("cylinder", [0, y + 0.20, 0], [radius * 1.02, 0.04, radius * 1.02], "#d0ecea"); // Chrome trim line

      // Wrap-around ribbon windows
      for (let face = 0; face < 4; face++) {
        const angle = (face * Math.PI) / 2;
        const wx = Math.sin(angle) * radius * 0.94;
        const wz = Math.cos(angle) * radius * 0.94;
        
        if (floor > 0 || face !== 0) {
          b.group([wx, y + floorHeight * 0.55, wz], [0, angle, 0], [1, 1, 1], () => {
            b.box([0.62, 0.44, 0.03], [0, 0, 0], "#d0ecea"); // Chrome frame
            b.box([0.56, 0.38, 0.015], [0, 0, 0.02], "#a6f7ff", [0, 0, 0], "glass"); // Glass pane
          });
        }
      }

      // Inter-floor chrome divider ring
      if (floor < floors - 1) {
        b.add("cylinder", [0, y + floorHeight, 0], [radius * 1.04, 0.06, radius * 1.04], "#e2f2f1");
      }
    }

    // --- GLASS DOME CROWN ON TOP ---
    const topY = base + floors * floorHeight;
    b.add("cylinder", [0, topY, 0], [radius * 1.06, 0.06, radius * 1.06], "#d0ecea"); // Chrome dome base collar
    b.add("sphere", [0, topY + 0.18, 0], [radius * 0.96, radius * 0.65, radius * 0.96], "#70e5f3", [0, 0, 0], "glass"); // Glass dome roof
    b.add("cylinder", [0, topY + 0.38, 0], [radius * 0.2, 0.08, radius * 0.2], "#d0ecea"); // Chrome rooftop cap/spire

    // Ground floor entrance and marquee canopy
    const frontZ = depth / 2;
    b.box([0.46, 0.68, 0.05], [0, base + 0.34, frontZ], "#d0ecea");
    b.box([0.36, 0.58, 0.025], [0, base + 0.34, frontZ + 0.02], "#a6f7ff", [0, 0, 0], "glass");
    b.box([0.7, 0.06, 0.35], [0, base + floorHeight * 0.65, frontZ + 0.12], "#f3f0eb");
    b.add("cylinder", [0, base + floorHeight * 0.65 + 0.03, frontZ + 0.12], [0.35, 0.04, 0.2], "#35a79c");

    addMoss(b, width, depth, topY + 0.45, moss, seed);
    return b.parts;
  }

  // --- FALLBACK LOGIC FOR ALL OTHER BUILDING VARIANTS ---
  const colors = ["#e8bd7d", "#f2d49a", "#c98f5e", "#f5e0b1"];
  const wallColor = colors[seed % colors.length]!;

  if (variant === "garden-pavilion") {
    const y = 1.18;
    const roofY = base + y + 0.27;
    const px = width * 0.36;
    const pz = depth * 0.36;

    // Stage 1: Open-air pearl-white garden pavilion.
    b.box(
      [width * 0.84, 0.12, depth * 0.84],
      [0, base + 0.06, 0],
      "#e8f7f4"
    );

    b.box(
      [width * 0.78, 0.035, depth * 0.78],
      [0, base + 0.135, 0],
      "#9cddd3",
      [0, 0, 0],
      "metal"
    );

    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        b.add(
          "cylinder",
          [x * px, base + y / 2, z * pz],
          [0.065, y, 0.065],
          "#f0f8f4",
          [0, 0, 0],
          "metal"
        );

        b.add(
          "sphere",
          [x * px, base + y, z * pz],
          [0.09, 0.065, 0.09],
          "#66d9d5",
          [0, 0, 0],
          "glass"
        );
      }
    }

    b.add(
      "roof",
      [0, roofY, 0],
      [width + 0.08, 0.54, depth + 0.08],
      "#d9f4ec"
    );

    // Distinct aqua roof trim.
    for (const side of [-1, 1]) {
      b.box(
        [width * 0.92, 0.055, 0.055],
        [0, roofY - 0.15, side * depth * 0.42],
        "#58cfc8",
        [0, 0, 0],
        "metal"
      );
    }

    // Two symmetrical garden benches.
    for (const side of [-1, 1]) {
      b.box(
        [width * 0.27, 0.075, 0.22],
        [side * width * 0.19, base + 0.34, -depth * 0.2],
        "#c6e9df"
      );

      for (const leg of [-1, 1]) {
        b.box(
          [0.045, 0.22, 0.045],
          [side * width * 0.19 + leg * width * 0.1,
           base + 0.21,
           -depth * 0.2],
          "#77bcb2",
          [0, 0, 0],
          "metal"
        );
      }
    }

    if (stage >= 1) {
      // Stage 2: Cyan glass railings and decorative lighting.
      for (const side of [-1, 1]) {
        b.box(
          [0.045, 0.37, depth * 0.49],
          [side * width * 0.35, base + 0.37, 0],
          "#8eece7",
          [0, 0, 0],
          "glass"
        );

        b.box(
          [0.06, 0.045, depth * 0.51],
          [side * width * 0.35, base + 0.57, 0],
          "#f4fffa",
          [0, 0, 0],
          "metal"
        );

        planter(
          b,
          [side * width * 0.27, base + 0.14, depth * 0.24],
          0.18
        );

        // Hanging aqua pendant lights.
        b.stem(
          [side * width * 0.2, roofY - 0.16, 0],
          [side * width * 0.2, roofY - 0.38, 0],
          0.012,
          "#b7ddd6"
        );

        b.add(
          "sphere",
          [side * width * 0.2, roofY - 0.42, 0],
          [0.095, 0.095, 0.095],
          "#9cfaff",
          [0, 0, 0],
          "glass"
        );
      }

      // Small central fountain-like feature.
      b.add(
        "cylinder",
        [0, base + 0.2, depth * 0.12],
        [0.22, 0.12, 0.22],
        "#dff9f4"
      );

      b.add(
        "cylinder",
        [0, base + 0.275, depth * 0.12],
        [0.17, 0.025, 0.17],
        "#55d9dd",
        [0, 0, 0],
        "glass"
      );
    }

    if (stage >= 2) {
      // Stage 3: Advanced rooftop garden and floating canopy.
      const canopyY = roofY + 0.43;

      for (const side of [-1, 1]) {
        b.add(
          "cylinder",
          [side * width * 0.26, roofY + 0.17, 0],
          [0.035, 0.36, 0.035],
          "#e7f9f6",
          [0, 0, 0],
          "metal"
        );

        b.box(
          [width * 0.29, 0.065, depth * 0.49],
          [side * width * 0.25, canopyY, 0],
          "#8fece7",
          [0, 0, 0],
          "glass"
        );

        b.box(
          [width * 0.27, 0.025, depth * 0.44],
          [side * width * 0.25, canopyY + 0.05, 0],
          "#f4fffa",
          [0, 0, 0],
          "metal"
        );

        planter(
          b,
          [side * width * 0.25, roofY + 0.16, depth * 0.18],
          0.16
        );

        // Hanging greenery below the canopy.
        for (const z of [-1, 1]) {
          b.stem(
            [side * width * 0.25, canopyY - 0.05, z * depth * 0.15],
            [side * width * 0.25, canopyY - 0.23, z * depth * 0.15],
            0.012,
            "#4da878"
          );

          b.foliage(
            [side * width * 0.25, canopyY - 0.22, z * depth * 0.15],
            0.095,
            "#6cda9c"
          );
        }
      }

      // Signature pearl-and-aqua rooftop ornament.
      b.add(
        "cylinder",
        [0, roofY + 0.22, 0],
        [0.1, 0.35, 0.1],
        "#f4fffa",
        [0, 0, 0],
        "metal"
      );

      b.add(
        "sphere",
        [0, roofY + 0.48, 0],
        [0.19, 0.19, 0.19],
        "#7ce9ef",
        [0, 0, 0],
        "glass"
      );
    }

    addMoss(b, width, depth, roofY + 0.27, moss, seed);
    return b.parts;
  }

  if (variant === "wind-tower") {
    const height = floors * floorHeight;
    const radius = Math.min(width, depth) * 0.25;
    b.add("cylinder", [0, base + height / 2, 0], [radius, height, radius], "#b7d8cb");
    for (let floor = 0; floor < floors; floor++) {
      const y = base + 0.62 + floor * floorHeight;
      b.add("cylinder", [0, y - 0.27, 0], [radius * 1.13, 0.065, radius * 1.13], "#f0e6cf");
      for (let face = 0; face < 4; face++) {
        const angle = face * Math.PI / 2;
        windowPane(b, [Math.sin(angle) * radius, y, Math.cos(angle) * radius], angle, 0.24, 0.27);
      }
    }
    const deck = base + height;
    b.add("cylinder", [0, deck, 0], [radius * 1.2, 0.09, radius * 1.2], "#e6e6d1");
    b.stem([0, deck, 0], [0, deck + 0.7, 0], 0.038, "#d9e5de");
    b.group([0, deck + 0.7, 0.03], [0, seed % 3 * 0.3, 0], [1, 1, 1], () => {
      b.add("sphere", [0, 0, 0], [0.085, 0.085, 0.085], "#66a698");
      for (let blade = 0; blade < 3; blade++) b.group([0, 0, 0], [0, 0, blade * Math.PI * 2 / 3], [1, 1, 1], () => {
        b.box([0.065, 0.48, 0.035], [0, 0.27, 0.055], "#e9f0df");
      });
    });
    if (stage === 2) for (const side of [-1, 1]) planter(b, [side * radius * 0.65, deck + 0.05, -radius * 0.35], 0.15);
    addMoss(b, width, depth, deck + 0.1, moss, seed);
    return b.parts;
  }

  if (variant === "greenhouse") {
    const height = floors * floorHeight;
    b.box([width, height, depth], [0, base + height / 2, 0], "#66daca", [0, 0, 0], "greenhouse");
    for (let column = 0; column <= 4; column++) {
      const x = (column / 4 - 0.5) * width;
      for (const side of [-1, 1]) b.box([0.045, height, 0.045], [x, base + height / 2, side * depth / 2], "#f1ead7");
    }
    for (const side of [-1, 1]) {
      b.box([width, 0.045, 0.045], [0, base + height * 0.55, side * depth / 2], "#f1ead7");
      for (let z = -depth / 2; z <= depth / 2; z += depth / 2) b.box([0.045, height, 0.045], [side * width / 2, base + height / 2, z], "#eceddd");
    }
    b.add("gable", [0, base + height + 0.3, 0], [width + 0.08, 0.6, depth + 0.08], "#b3f6ed", [0, 0, 0], "greenhouse");
    entrance(b, width, depth, stage);
    addMoss(b, width, depth, base + height + 0.6, moss, seed);
    return b.parts;
  }


  // === FRUTIGER AERO CUSTOM BUILDINGS ===
  // Each building has its own silhouette, architecture and growth stages.

  if (variant === "rooftop-farm") {
    const white = "#edfff8";
    const aqua = "#68e2e4";
    const green = "#4fc979";
    const height = base + floors * floorHeight;

    // Broad, low agricultural building with a bright glass frontage.
    b.box([width * 0.94, height - base, depth * 0.88],
      [0, base + (height - base) / 2, 0], "#d8f4e8");

    b.box([width * 0.96, 0.13, depth * 0.9],
      [0, base + 0.08, 0], "#f6fffb");

    // Horizontal ribbons of aqua greenhouse glazing.
    for (let level = 0; level < floors; level++) {
      const y = base + level * floorHeight + floorHeight * 0.57;
      b.box([width * 0.82, 0.38, 0.035],
        [0, y, depth * 0.45], "#80ecf4", [0, 0, 0], "glass");
      b.box([width * 0.82, 0.055, 0.065],
        [0, y + 0.22, depth * 0.46], white, [0, 0, 0], "metal");
    }

    // Main rooftop farm platform.
    b.box([width * 0.99, 0.14, depth * 0.98],
      [0, height + 0.06, 0], white);
    b.box([width * 0.9, 0.045, depth * 0.88],
      [0, height + 0.15, 0], "#7ed5a6");

    // Crop beds, with alternating lush rows.
    for (let row = 0; row < 5; row++) {
      const z = (row - 2) * depth * 0.145;
      b.box([width * 0.73, 0.09, depth * 0.095],
        [0, height + 0.22, z], "#f1fffa");
      b.box([width * 0.7, 0.025, depth * 0.075],
        [0, height + 0.275, z], "#2f986a");

      for (let col = 0; col < 7; col++) {
        const x = (col - 3) * width * 0.095;
        b.foliage([x, height + 0.34, z],
          0.065, (row + col) % 2 ? green : "#a0e974");
      }
    }

    // Signature stepped upper greenhouse and hydroponic canopy.
    if (stage >= 1) {
      const upperY = height + 0.54;
      b.box([width * 0.63, 0.055, depth * 0.58],
        [0, upperY, -depth * 0.04], white, [0, 0, 0], "metal");

      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          b.add("cylinder",
            [x * width * 0.3, height + 0.36, z * depth * 0.27 - depth * 0.04],
            [0.028, 0.4, 0.028], "#f8fffe",
            [0, 0, 0], "metal");
        }
      }

      b.box([width * 0.59, 0.045, depth * 0.54],
        [0, upperY + 0.04, -depth * 0.04],
        aqua, [0, 0, 0], "glass");

      // Aqua irrigation channels down the side.
      for (const side of [-1, 1]) {
        b.box([0.055, 0.04, depth * 0.7],
          [side * width * 0.44, height + 0.18, 0],
          "#39bce1", [0, 0, 0], "glass");
      }
    }

    if (stage >= 2) {
      // Elevated solar-greenhouse crown.
      const y = height + 0.8;
      b.box([width * 0.44, 0.06, depth * 0.42],
        [0, y, -depth * 0.06], "#eaffff",
        [0, 0, 0], "metal");
      b.add("sphere", [0, y + 0.13, -depth * 0.06],
        [width * 0.2, 0.22, depth * 0.19],
        "#9ceff5", [0, 0, 0], "glass");

      for (const side of [-1, 1]) {
        solarPanel(b,
          [side * width * 0.3, height + 0.6, depth * 0.31],
          width * 0.21, depth * 0.18);
      }
    }

    // Farm entrance.
    b.box([0.45, 0.63, 0.04],
      [0, base + 0.315, depth * 0.46],
      "#b8fbff", [0, 0, 0], "glass");
    b.box([0.65, 0.07, 0.2],
      [0, base + 0.67, depth * 0.49], white);

    addMoss(b, width, depth, height + 0.3, moss, seed);
    return b.parts;
  }

  if (variant === "community-library") {
    const radius = Math.min(width * 0.43, depth * 0.45);
    const height = base + floors * floorHeight;
    const glass = "#82e8f5";
    const pearl = "#f4fffc";

    // Low circular pavilion: visually unlike the rectangular buildings.
    b.add("cylinder", [0, base + 0.065, 0],
      [radius * 1.22, 0.13, radius * 1.22],
      "#d5f8f3", [0, 0, 0], "metal");

    b.add("cylinder", [0, base + (height - base) / 2, 0],
      [radius, height - base, radius],
      glass, [0, 0, 0], "glass");

    // Visible bookshelf bands through the glazed facade.
    for (let level = 0; level < floors; level++) {
      const y = base + level * floorHeight + 0.28;
      for (let shelf = 0; shelf < 2; shelf++) {
        const shelfY = y + shelf * 0.2;
        b.box([radius * 1.15, 0.035, 0.18],
          [0, shelfY, -radius * 0.35], "#e9fff8");

        for (let book = 0; book < 9; book++) {
          const x = (book - 4) * radius * 0.12;
          const colors = ["#3cadd0", "#78dca6", "#f2d58a", "#88c3f1"];
          b.box([0.055, 0.13, 0.11],
            [x, shelfY + 0.08, -radius * 0.35],
            colors[(book + level) % colors.length]!);
        }
      }
    }

    // Circular white roof with aqua ring.
    b.add("cylinder", [0, height + 0.045, 0],
      [radius * 1.24, 0.09, radius * 1.24],
      pearl, [0, 0, 0], "metal");
    b.add("cylinder", [0, height + 0.1, 0],
      [radius * 1.16, 0.025, radius * 1.16],
      "#52d8de", [0, 0, 0], "glass");

    // Sweeping flying-saucer roof silhouette.
    b.add("sphere", [0, height + 0.13, 0],
      [radius * 1.22, 0.19, radius * 1.22],
      pearl);

    // Tall glazed entrance portal.
    b.box([radius * 0.62, 0.78, 0.055],
      [0, base + 0.4, radius + 0.02],
      "#c4fcff", [0, 0, 0], "glass");
    b.box([radius * 0.8, 0.075, 0.2],
      [0, base + 0.84, radius + 0.08],
      pearl, [0, 0, 0], "metal");

    if (stage >= 1) {
      // Central skylight dome.
      b.add("sphere", [0, height + 0.29, 0],
        [radius * 0.54, 0.31, radius * 0.54],
        "#8ceaf8", [0, 0, 0], "glass");

      // White vertical facade ribs.
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        b.add("cylinder",
          [Math.sin(angle) * radius * 0.99,
           base + (height - base) / 2,
           Math.cos(angle) * radius * 0.99],
          [0.025, height - base, 0.025],
          "#f8fffd", [0, 0, 0], "metal");
      }
    }

    if (stage >= 2) {
      // Luminous rooftop orb and outdoor reading gardens.
      b.add("sphere", [0, height + 0.59, 0],
        [0.12, 0.12, 0.12],
        "#c4ffff", [0, 0, 0], "glass");

      for (const side of [-1, 1]) {
        planter(b,
          [side * radius * 1.08, base + 0.03, radius * 0.46],
          0.16);
        b.box([0.34, 0.06, 0.15],
          [side * radius * 0.9, base + 0.22, radius * 0.8],
          "#d5f6e9");
      }
    }

    addMoss(b, width, depth, height + 0.2, moss, seed);
    return b.parts;
  }

  if (variant === "eco-apartments") {
    const pearl = "#f0fffb";
    const cyan = "#77e4f2";
    const height = base + floors * floorHeight;
    const towerWidth = width * 0.72;
    const towerDepth = depth * 0.7;

    // Narrow, tall tower: staggered levels make it unmistakably residential.
    b.box([towerWidth, height - base, towerDepth],
      [0, base + (height - base) / 2, 0],
      "#dcefeb");

    // Continuous vertical glass spine.
    b.box([towerWidth * 0.24, height - base, 0.045],
      [0, base + (height - base) / 2, towerDepth / 2 + 0.025],
      "#8de9f6", [0, 0, 0], "glass");

    for (let floor = 0; floor < floors; floor++) {
      const y = base + floor * floorHeight;
      const shift = floor % 2 === 0 ? -1 : 1;

      // Alternating projecting residential balconies.
      b.box([towerWidth * 0.78, 0.09, towerDepth * 0.46],
        [shift * towerWidth * 0.14,
         y + 0.17,
         towerDepth * 0.53],
        pearl, [0, 0, 0], "metal");

      // Curved-feeling aqua glass balcony fronts.
      b.box([towerWidth * 0.78, 0.25, 0.035],
        [shift * towerWidth * 0.14,
         y + 0.34,
         towerDepth * 0.76],
        cyan, [0, 0, 0], "glass");

      b.box([towerWidth * 0.8, 0.045, 0.045],
        [shift * towerWidth * 0.14,
         y + 0.48,
         towerDepth * 0.76],
        pearl, [0, 0, 0], "metal");

      // Apartment windows, clearly separated by floors.
      for (const side of [-1, 1]) {
        b.box([towerWidth * 0.28, 0.4, 0.04],
          [side * towerWidth * 0.29,
           y + 0.51,
           towerDepth / 2 + 0.03],
          "#65d9ee", [0, 0, 0], "glass");
      }

      // Balconies get individual mini-gardens.
      if (stage >= 1 || floor === 0) {
        const x = shift * towerWidth * 0.14
          + (shift === 1 ? towerWidth * 0.25 : -towerWidth * 0.25);
        b.foliage([x, y + 0.49, towerDepth * 0.58],
          0.13, floor % 2 ? "#54ca87" : "#8be4a0");
      }

      // White floor divider.
      b.box([towerWidth + 0.045, 0.055, towerDepth + 0.05],
        [0, y + floorHeight - 0.03, 0],
        pearl, [0, 0, 0], "metal");
    }

    // Ground-floor lobby.
    b.box([towerWidth * 0.5, 0.64, 0.05],
      [0, base + 0.32, towerDepth / 2 + 0.045],
      "#b1faff", [0, 0, 0], "glass");

    // Rooftop garden lounge.
    b.box([towerWidth * 1.1, 0.12, towerDepth * 1.1],
      [0, height + 0.06, 0], pearl, [0, 0, 0], "metal");

    if (stage >= 1) {
      for (const side of [-1, 1]) {
        planter(b,
          [side * towerWidth * 0.39, height + 0.13, 0],
          0.16);
      }
    }

    if (stage >= 2) {
      // Signature floating cyan canopy above the rooftop lounge.
      for (const x of [-1, 1]) {
        b.add("cylinder",
          [x * towerWidth * 0.39, height + 0.34, 0],
          [0.035, 0.48, 0.035],
          "#f5fffc", [0, 0, 0], "metal");
      }

      b.box([towerWidth * 0.95, 0.065, towerDepth * 0.65],
        [0, height + 0.59, 0],
        "#8deaf4", [0, 0, 0], "glass");

      // Hanging vines from the lounge canopy.
      for (const side of [-1, 1]) {
        b.foliage(
          [side * towerWidth * 0.35, height + 0.4, 0],
          0.14, "#5bcf92");
      }
    }

    addMoss(b, width, depth, height + 0.16, moss, seed);
    return b.parts;
  }

  let roofY = facade(b, width, depth, floors, floorHeight, wallColor);
  flatRoof(b, width, depth, roofY);
  entrance(b, width, depth, stage);
  addMoss(b, width, depth, roofY + 0.16, moss, seed);
  return b.parts;
}

function buildPlant(species: string, seed: number): Model {
  const b = new Builder();
  if (species === "fern") {
    const points: Vec3[] = [[0, 0, 0], [0, 0.18, 0.08], [0, 0.31, 0.2], [0, 0.39, 0.34]];
    for (let frond = 0; frond < 5; frond++) b.group([0, 0, 0], [0, frond * Math.PI * 2 / 5, 0], [1, 1, 1], () => {
      for (let row = 1; row < points.length; row++) {
        const point = points[row]!;
        b.stem(points[row - 1]!, point, 0.009);
        for (const side of [-1, 1]) b.leaf([side * 0.06, point[1] + 0.04, point[2] + 0.015], [0.35, 0, -side], 0.18 - (row - 1) * 0.035, 0.065 - (row - 1) * 0.01, (row + frond) % 2 === 0 ? "#78df76" : "#29ac68");
      }
      b.leaf([0, 0.42, 0.39], [1, 0, 0], 0.16, 0.055, "#a2ed7e");
    });
  } else if (species === "flower") {
    const petalColor = ["#ff7f95", "#ffd54d", "#ba8aff", "#fff1a3"][seed % 4]!;
    const stalks = [[-0.16, 0.02, 0.61], [0.15, 0.07, 0.47], [0.02, -0.14, 0.76]];
    stalks.forEach(([x, z, height], index) => b.group([x!, 0, z!], [0, index * 1.7, 0], [1, 1, 1], () => {
      b.stem([0, 0, 0], [0, height!, 0], 0.014);
      for (const side of [-1, 1]) b.leaf([side * 0.08, height! * (side === -1 ? 0.3 : 0.55) + 0.08, 0], [0, 0, -side * 0.75], 0.24, 0.095, side === -1 ? "#599e65" : "#83ba75");
      b.group([0, height!, 0], [0.14, index * 0.8, 0.08], [0.9, 0.9, 0.9], () => {
        for (let petal = 0; petal < 6; petal++) b.group([0, 0, 0], [0, petal * Math.PI * 2 / 6, 0], [1, 1, 1], () => {
          b.add("sphere", [0, 0, 0.105], [0.065, 0.025, 0.105], petalColor);
        });
        b.add("sphere", [0, 0.025, 0], [0.065, 0.0325, 0.065], "#d5a24e");
      });
    }));
  } else if (species === "tree") {
    b.stem([0, 0, 0], [0, 0.98, 0], 0.075, "#977652");
    for (const side of [-1, 1]) b.stem([0, 0.53, 0], [side * 0.23, 0.89, 0.03], 0.028, "#977652");
    [[0, 1.02, 0, 0.33], [-0.23, 0.89, 0.03, 0.27], [0.22, 0.92, 0.02, 0.28], [0, 0.95, -0.23, 0.26], [0.04, 1.23, -0.025, 0.25]].forEach(([x, y, z, radius], index) => {
      b.foliage([x!, y!, z!], radius!, ["#31ae55", "#59cf56", "#87da65"][(seed + index) % 3]!);
    });
  } else if (species === "grass" || species === "moss") {
    for (let blade = 0; blade < 7; blade++) {
      const length = 0.42 + blade % 3 * 0.1, tilt = 0.2 + blade % 3 * 0.16;
      b.group([0, 0, 0], [0, blade * 2.4, 0], [1, 1, 1], () => {
        b.leaf([0, length / 2 * Math.cos(tilt), length / 2 * Math.sin(tilt)], [tilt, 0, 0], length, 0.055, (seed + blade) % 2 === 0 ? "#a0e46f" : "#36b765");
      });
    }
  } else {
    b.stem([0, 0, 0], [0, 0.27, 0], 0.035, "#817152");
    [[-0.2, 0.26, 0.02, 0.22], [0.2, 0.27, 0.05, 0.23], [0, 0.28, -0.18, 0.24], [0, 0.42, 0.01, 0.27]].forEach(([x, y, z, radius], index) => {
      b.foliage([x!, y!, z!], radius!, index % 2 === 0 ? "#2aa757" : "#75ce58");
    });
    if (seed % 3 === 0) for (let berry = 0; berry < 5; berry++) b.add("sphere", [Math.cos(berry * 2.4) * 0.22, 0.46 + berry % 2 * 0.08, Math.sin(berry * 2.4) * 0.22], [0.027, 0.027, 0.027], "#df927d");
  }
  return b.parts;
}

/** Small LRU: model count stays bounded when worlds are reset repeatedly. */
const modelCache = new Map<string, Model>();
function cached(key: string, build: () => Model) {
  const existing = modelCache.get(key);
  if (existing) {
    modelCache.delete(key);
    modelCache.set(key, existing);
    return existing;
  }
  const model = build();
  modelCache.set(key, model);
  if (modelCache.size > 256) modelCache.delete(modelCache.keys().next().value!);
  return model;
}

export function buildingModel(variant: string, width: number, depth: number, stage: number, seed: number, floors?: number, moss = 0): Model {
  const variation = seed % 12;
  return cached(`building:${variant}:${width}:${depth}:${stage}:${variation}:${floors}:${moss}`, () => buildBuilding(variant, width, depth, stage, variation, floors, moss));
}

export function plantModel(species: string, seed: number): Model {
  const variation = seed % 12;
  return cached(`plant:${species}:${variation}`, () => buildPlant(species, variation));
}

export type Batch = { key: string; shape: Shape; finish: Finish; parts: Part[] };
export function batchParts(parts: readonly Part[]): Batch[] {
  const batches = new Map<string, Batch>();
  for (const part of parts) {
    const key = `${part.shape}:${part.finish}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { key, shape: part.shape, finish: part.finish, parts: [] };
      batches.set(key, batch);
    }
    batch.parts.push(part);
  }
  return [...batches.values()];
}

export function placeModel(model: Model, root: Matrix, output: Part[]) {
  for (const part of model) output.push({ ...part, matrix: multiply(root, part.matrix) });
}

/** O(occupied cells + candidate cells); checks plants as well as buildings. */
function plotDistance(
  ax: number,
  az: number,
  aw: number,
  ad: number,
  bx: number,
  bz: number,
  bw: number,
  bd: number
): number {
  const dx = Math.max(
    bx - (ax + aw),
    ax - (bx + bw),
    0
  );

  const dz = Math.max(
    bz - (az + ad),
    az - (bz + bd),
    0
  );

  return Math.hypot(dx, dz);
}


function edenFootprintsOverlap(
  ax: number, az: number, aw: number, ad: number,
  bx: number, bz: number, bw: number, bd: number,
  clearance = 0
): boolean {
  return (
    ax < bx + bw + clearance - 0.0001 &&
    ax + aw + clearance > bx + 0.0001 &&
    az < bz + bd + clearance - 0.0001 &&
    az + ad + clearance > bz + 0.0001
  );
}

export function findFreePlot(
  buildings: readonly Plot[],
  plants: readonly Plot[],
  width: number,
  depth: number,
  isValid?: (
    x: number,
    z: number,
    width: number,
    depth: number
  ) => boolean
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(depth) ||
    width < 1 ||
    depth < 1 ||
    width > GRID_SIZE ||
    depth > GRID_SIZE
  ) return null;

  const structures = buildings.filter(
    item => item.footprint !== undefined
  );

  const candidates: {
    x: number;
    z: number;
    score: number;
  }[] = [];

  for (let z = 0; z <= GRID_SIZE - depth; z++) {
    for (let x = 0; x <= GRID_SIZE - width; x++) {
      let blocked = false;
      let nearestBuilding = Infinity;

      // Buildings and residents always reserve space.
      for (const item of buildings) {
        const overlaps = edenFootprintsOverlap(
          x, z, width, depth,
          item.gridPosition.x,
          item.gridPosition.z,
          item.footprint?.width ?? 0.5,
          item.footprint?.depth ?? 0.5
        );

        if (overlaps) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      // Only trees permanently reserve building space.
      for (const plant of plants) {
        if (plant.species !== "tree") continue;

        const distance = plotDistance(
          x, z, width, depth,
          plant.gridPosition.x,
          plant.gridPosition.z,
          0.5, 0.5
        );

        // Larger safety zone for mature tree trunks.
        if (distance < 0.95) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      for (const building of structures) {
        const distance = plotDistance(
          x, z, width, depth,
          building.gridPosition.x,
          building.gridPosition.z,
          building.footprint?.width ?? 1,
          building.footprint?.depth ?? 1
        );

        nearestBuilding = Math.min(
          nearestBuilding,
          distance
        );
      }

      const centerDistance = Math.hypot(
        x + width / 2 - GRID_SIZE / 2,
        z + depth / 2 - GRID_SIZE / 2
      );

      const hash = Math.sin(
        x * 127.1 +
        z * 311.7 +
        buildings.length * 74.7
      ) * 43758.5453;

      const variation = hash - Math.floor(hash);

      const score = structures.length
        ? -Math.abs(nearestBuilding - 0.15) * 3
          + variation * 2
          + Math.min(nearestBuilding, 5) * 0.35
        : -centerDistance + variation * 2;

      candidates.push({ x, z, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    if (
      !isValid ||
      isValid(candidate.x, candidate.z, width, depth)
    ) {
      return { x: candidate.x, z: candidate.z };
    }
  }

  return null;
}




export function findFreePlantSite(
  occupied: readonly Plot[],
  random: () => number = Math.random,
  isValid?: (x: number, z: number) => boolean,
  species: "tree" | "shrub" | "fern" | "flower" | "grass" = "tree"
) {
  let best: { x: number; z: number } | null = null;
  let bestScore = -Infinity;

  const isTree = species === "tree";

  const check = (x: number, z: number) => {
    if (
      x < 0 ||
      z < 0 ||
      x >= GRID_SIZE - 0.5 ||
      z >= GRID_SIZE - 0.5
    ) return;

    let nearestTree = Infinity;
    let nearestPlant = Infinity;
    let nearestBuilding = Infinity;

    for (const item of occupied) {
      const distance = plotDistance(
        x, z, 0.5, 0.5,
        item.gridPosition.x,
        item.gridPosition.z,
        item.footprint?.width ?? 0.5,
        item.footprint?.depth ?? 0.5
      );

      if (item.footprint) {
        const overlaps = edenFootprintsOverlap(
          x, z, 0.5, 0.5,
          item.gridPosition.x,
          item.gridPosition.z,
          item.footprint.width,
          item.footprint.depth,
          isTree ? 1.0 : 0.08
        );
        if (overlaps) return;

        nearestBuilding = Math.min(
          nearestBuilding,
          distance
        );
      } else if (item.species === "tree") {
        const clearance = isTree ? 0.8 : 0.16;

        if (distance < clearance) return;

        nearestTree = Math.min(
          nearestTree,
          distance
        );
      } else {
        const clearance = isTree ? 0.3 : 0.08;

        if (distance < clearance) return;

        nearestPlant = Math.min(
          nearestPlant,
          distance
        );
      }
    }

    if (isValid && !isValid(x, z)) return;

    const coverage = isTree
      ? Math.min(nearestTree, 4)
      : Math.min(nearestPlant, 2);

    const nearBuildings = Number.isFinite(nearestBuilding)
      ? Math.max(
          0,
          2.5 - Math.abs(nearestBuilding - 1.2)
        )
      : 0;

    const score =
      coverage * (isTree ? 3 : 1.5) +
      nearBuildings * 0.35 +
      random() * 1.5;

    if (score > bestScore) {
      bestScore = score;
      best = { x, z };
    }
  };

  const divisions = 18;
  const step = GRID_SIZE / divisions;

  const offsetX = random() * step;
  const offsetZ = random() * step;

  for (let gz = 0; gz < divisions; gz++) {
    for (let gx = 0; gx < divisions; gx++) {
      const x = (
        gx * step +
        offsetX +
        (random() - 0.5) * step * 0.5
      ) % GRID_SIZE;

      const z = (
        gz * step +
        offsetZ +
        (random() - 0.5) * step * 0.5
      ) % GRID_SIZE;

      check(
        (x + GRID_SIZE) % GRID_SIZE,
        (z + GRID_SIZE) % GRID_SIZE
      );
    }
  }

  for (let i = 0; i < 72; i++) {
    check(
      random() * (GRID_SIZE - 0.5),
      random() * (GRID_SIZE - 0.5)
    );
  }

  return best;
}


