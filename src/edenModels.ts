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
export type Plot = { gridPosition: { x: number; z: number }; footprint?: { width: number; depth: number } };
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
    const y = 1.1;
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      b.add("cylinder", [x * width * 0.38, base + y / 2, z * depth * 0.38], [0.055, y, 0.055], "#d2b28c");
    }
    b.add("roof", [0, base + y + 0.27, 0], [width + 0.12, 0.54, depth + 0.12], "#548d74");
    b.box([width * 0.7, 0.09, 0.22], [0, 0.4, -depth * 0.3], "#ba936e");
    for (const side of [-1, 1]) b.box([0.06, 0.32, 0.15], [side * width * 0.25, 0.2, -depth * 0.3], "#ba936e");
    if (stage > 0) planter(b, [0, base, 0], 0.26);
    if (stage === 2) for (const side of [-1, 1]) planter(b, [side * width * 0.3, base, depth * 0.3], 0.19);
    addMoss(b, width, depth, base + y + 0.54, moss, seed);
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
    // Twelve deterministic tree variations across five silhouettes.
    const style = seed % 5;
    const variant = Math.floor(seed / 5);
    const heightScale = 0.88 + (seed % 4) * 0.085;
    const widthScale = 0.85 + ((seed * 7) % 5) * 0.075;
    const trunkColor = ["#8d6b4e", "#997756", "#806347", "#a07c58"][seed % 4]!;
    const leaves = [
      ["#36ad67", "#64cf77", "#95e19a"],
      ["#2eae83", "#58d0a2", "#8fe3b5"],
      ["#5eaf58", "#8ed46e", "#b6e891"],
      ["#319f75", "#5ac3a0", "#9cdec5"],
      ["#59b26c", "#86d493", "#b3e9a8"]
    ][style]!;

    // Tree-local scaling gives every seed distinct proportions.
    b.group(
      [0, 0, 0],
      [0, seed * 0.73, 0],
      [widthScale, heightScale, widthScale],
      () => {
        const foliage = (
          x: number, y: number, z: number,
          radius: number, index: number
        ) => {
          b.foliage(
            [x, y, z],
            radius,
            leaves[(seed + index) % leaves.length]!
          );
        };

        if (style === 0) {
          // Rounded deciduous tree: dense, full canopy.
          b.stem([0, 0, 0], [0, 0.91, 0], 0.072, trunkColor);

          for (let i = 0; i < 5; i++) {
            const angle = i * Math.PI * 2 / 5;
            const x = Math.cos(angle) * 0.25;
            const z = Math.sin(angle) * 0.25;
            b.stem(
              [0, 0.61, 0],
              [x * 0.7, 0.98, z * 0.7],
              0.026,
              trunkColor
            );
            foliage(x, 1.02 + i % 2 * 0.07, z, 0.29, i);
          }

          foliage(0, 1.19, 0, 0.36, 6);
          foliage(0.08, 0.93, -0.08, 0.3, 7);

        } else if (style === 1) {
          // Tall, narrow tree: vertical silhouette.
          b.stem([0, 0, 0], [0, 1.48, 0], 0.052, trunkColor);

          for (let layer = 0; layer < 5; layer++) {
            const y = 0.62 + layer * 0.19;
            const radius = 0.24 - layer * 0.023;

            foliage(
              Math.sin(layer * 2.3) * 0.055,
              y,
              Math.cos(layer * 2.3) * 0.055,
              radius,
              layer
            );
          }

          foliage(0, 1.57, 0, 0.19, 6);

        } else if (style === 2) {
          // Spreading oak: thick trunk, wide irregular crown.
          b.stem([0, 0, 0], [0, 0.83, 0], 0.09, trunkColor);

          for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI * 2 / 6 + variant * 0.2;
            const x = Math.cos(angle) * 0.43;
            const z = Math.sin(angle) * 0.38;
            const y = 0.94 + i % 3 * 0.08;

            b.stem(
              [0, 0.57 + i % 2 * 0.08, 0],
              [x, y, z],
              0.035,
              trunkColor
            );

            foliage(x, y + 0.06, z, 0.28 + i % 2 * 0.035, i);
          }

          foliage(0, 1.13, 0, 0.34, 7);
          foliage(-0.13, 0.94, 0.12, 0.3, 8);

        } else if (style === 3) {
          // Layered tree: distinct tiers of foliage.
          b.stem([0, 0, 0], [0, 1.4, 0], 0.065, trunkColor);

          for (let layer = 0; layer < 4; layer++) {
            const y = 0.57 + layer * 0.26;
            const spread = 0.35 - layer * 0.065;

            for (let i = 0; i < 3; i++) {
              const angle = i * Math.PI * 2 / 3 + layer * 0.7;
              const x = Math.cos(angle) * spread;
              const z = Math.sin(angle) * spread;

              b.stem(
                [0, y - 0.1, 0],
                [x * 0.7, y, z * 0.7],
                0.02,
                trunkColor
              );

              foliage(x, y, z, 0.19 + (3 - layer) * 0.012, layer * 3 + i);
            }
          }

          foliage(0, 1.47, 0, 0.2, 13);

        } else {
          // Asymmetric tree: offset crown and angled branches.
          const lean = seed % 2 === 0 ? 0.16 : -0.16;

          b.stem([0, 0, 0], [lean, 1.13, 0], 0.069, trunkColor);

          for (let i = 0; i < 6; i++) {
            const angle = i * 2.4 + seed * 0.15;
            const spread = 0.18 + i % 3 * 0.095;
            const x = lean + Math.cos(angle) * spread;
            const z = Math.sin(angle) * spread;
            const y = 0.87 + i % 4 * 0.12;

            b.stem(
              [lean * 0.65, 0.7, 0],
              [x * 0.75, y, z * 0.75],
              0.023,
              trunkColor
            );

            foliage(x, y, z, 0.23 + i % 2 * 0.045, i);
          }

          foliage(lean, 1.24, 0, 0.3, 8);
        }
      }
    );
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
export function findFreePlot(buildings: readonly Plot[], plants: readonly Plot[], width: number, depth: number) {
  if (!Number.isInteger(width) || !Number.isInteger(depth) || width < 1 || depth < 1 || width > GRID_SIZE || depth > GRID_SIZE) return null;
  const occupied = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (const item of [...buildings, ...plants]) {
    const left = Math.floor(item.gridPosition.x), top = Math.floor(item.gridPosition.z);
    const right = Math.ceil(item.gridPosition.x + (item.footprint?.width ?? 1));
    const bottom = Math.ceil(item.gridPosition.z + (item.footprint?.depth ?? 1));
    for (let z = Math.max(0, top); z < Math.min(GRID_SIZE, bottom); z++) {
      for (let x = Math.max(0, left); x < Math.min(GRID_SIZE, right); x++) occupied[z * GRID_SIZE + x] = 1;
    }
  }
  const candidates: { x: number; z: number; distance: number }[] = [];
  const centerX = (GRID_SIZE - width) / 2, centerZ = (GRID_SIZE - depth) / 2;
  for (let z = 0; z <= GRID_SIZE - depth; z++) for (let x = 0; x <= GRID_SIZE - width; x++) {
    candidates.push({ x, z, distance: (x - centerX) ** 2 + (z - centerZ) ** 2 });
  }
  // Spread buildings across the map rather than clustering at the center.
  // Prefer candidates far from existing occupied cells.
  const occupiedCells: { x: number; z: number }[] = [];
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (occupied[z * GRID_SIZE + x]) {
        occupiedCells.push({ x: x + 0.5, z: z + 0.5 });
      }
    }
  }

  candidates.sort((a, b) => {
    const spacingScore = (candidate: typeof a) => {
      if (!occupiedCells.length) return candidate.distance;

      const cx = candidate.x + width / 2;
      const cz = candidate.z + depth / 2;

      let nearest = Infinity;
      for (const cell of occupiedCells) {
        const distance =
          (cx - cell.x) ** 2 + (cz - cell.z) ** 2;
        nearest = Math.min(nearest, distance);
      }
      return nearest;
    };

    return spacingScore(b) - spacingScore(a)
      || a.z - b.z
      || a.x - b.x;
  });
  for (const { x, z } of candidates) {
    let free = true;
    for (let dz = 0; dz < depth && free; dz++) {
      for (let dx = 0; dx < width; dx++) if (occupied[(z + dz) * GRID_SIZE + x + dx]) { free = false; break; }
    }
    if (free) return { x, z };
  }
  return null;
}

export function findFreePlantSite(
  occupied: readonly Plot[],
  random: () => number = Math.random
) {
  let best: { x: number; z: number } | null = null;
  let bestScore = -Infinity;

  // Sample the entire board and choose an open location
  // that is relatively far from other objects.
  for (let attempt = 0; attempt < 120; attempt++) {
    const x = random() * GRID_SIZE;
    const z = random() * GRID_SIZE;

    let nearest = Infinity;
    let blocked = false;

    for (const item of occupied) {
      const width = item.footprint?.width ?? 0.5;
      const depth = item.footprint?.depth ?? 0.5;

      const dx = Math.max(
        item.gridPosition.x - x,
        0,
        x - (item.gridPosition.x + width)
      );

      const dz = Math.max(
        item.gridPosition.z - z,
        0,
        z - (item.gridPosition.z + depth)
      );

      const distance = Math.hypot(dx, dz);

      if (distance < (item.footprint ? 0.55 : 0.85)) {
        blocked = true;
        break;
      }

      nearest = Math.min(nearest, distance);
    }

    if (blocked) continue;

    // Favor open space without forcing a strict pattern.
    const score = nearest === Infinity ? random() : nearest;

    if (score > bestScore) {
      bestScore = score;
      best = { x, z };
    }
  }

  return best;
}