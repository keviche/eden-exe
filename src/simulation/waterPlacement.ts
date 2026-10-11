import { BOARD_SIZE, CELL_SIZE, GRID_SIZE } from "../edenModels";

type Point = { x: number; z: number };
type RiverPoint = Point & { width: number };

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function layoutForSeed(seed: number) {
  const random = seededRandom(seed);
  const range = (a: number, b: number) => a + random() * (b - a);
  const edge = BOARD_SIZE * 0.46;

  const startX = range(-BOARD_SIZE * 0.17, BOARD_SIZE * 0.17);
  const endX = range(-BOARD_SIZE * 0.17, BOARD_SIZE * 0.17);
  const bend1 = range(-BOARD_SIZE * 0.13, BOARD_SIZE * 0.13);
  const bend2 = range(-BOARD_SIZE * 0.07, BOARD_SIZE * 0.07);
  const phase = range(0, Math.PI * 2);
  const width = range(0.42, 0.78);

  const river: RiverPoint[] = [];

  for (let i = 0; i <= 100; i++) {
    const t = i / 100;

    const rawX =
      startX * (1 - t) +
      endX * t +
      Math.sin(t * Math.PI * 2 + phase) * bend1 +
      Math.sin(t * Math.PI * 4 + phase * 0.6) * bend2;

    const w = width * (1 + 0.18 * Math.sin(t * Math.PI * 5 + phase));

    river.push({
      x: Math.max(-edge + w, Math.min(edge - w, rawX)),
      z: -edge + t * edge * 2,
      width: w
    });
  }

  const lakeSide = random() < 0.5 ? -1 : 1;

  // Preserve random consumption from the removed lake.
  range(1.8, 3.1);
  range(1.4, 2.5);
  range(BOARD_SIZE * 0.20, BOARD_SIZE * 0.29);
  range(-BOARD_SIZE * 0.25, BOARD_SIZE * 0.25);

  const rx = range(2.0, 3.8);
  const rz = range(1.7, 3.2);
  const px = -lakeSide * range(BOARD_SIZE * 0.20, BOARD_SIZE * 0.30);
  const pz = range(-BOARD_SIZE * 0.30, BOARD_SIZE * 0.30);

  const phase1 = range(0, Math.PI * 2);
  const phase2 = range(0, Math.PI * 2);
  const wobble = range(0.06, 0.13);

  const pond: Point[] = [];

  for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2;
    const variation =
      1 +
      wobble * Math.sin(angle * 3 + phase1) +
      wobble * 0.45 * Math.cos(angle * 5 + phase2);

    pond.push({
      x: px + Math.cos(angle) * rx * variation,
      z: pz + Math.sin(angle) * rz * variation
    });
  }

  return { river, pond };
}

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = dx * dx + dz * dz;
  const t = length
    ? Math.max(0, Math.min(1,
        ((p.x - a.x) * dx + (p.z - a.z) * dz) / length
      ))
    : 0;

  return Math.hypot(
    p.x - (a.x + dx * t),
    p.z - (a.z + dz * t)
  );
}

function insidePolygon(p: Point, vertices: Point[]) {
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];

    if (
      (a.z > p.z) !== (b.z > p.z) &&
      p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

const cache = new Map<number, ReturnType<typeof layoutForSeed>>();

const placementCache = new Map<number, {
  isLandPoint: (x: number, z: number, clearance?: number) => boolean;
  isBuildingPlotValid: (
    x: number, z: number, width: number, depth: number
  ) => boolean;
  isPlantSiteValid: (x: number, z: number) => boolean;
}>();

export function createWaterPlacement(seed: number) {
  const existing = placementCache.get(seed);
  if (existing) return existing;

  let layout = cache.get(seed);

  if (!layout) {
    layout = layoutForSeed(seed);
    cache.set(seed, layout);
  }

  const { river, pond } = layout;

  function isLandPoint(x: number, z: number, clearance = 0.5) {
    const point = { x, z };

    for (let i = 0; i < river.length - 1; i++) {
      const a = river[i];
      const b = river[i + 1];

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = dx * dx + dz * dz;

      const t = length
        ? Math.max(0, Math.min(1,
            ((x - a.x) * dx + (z - a.z) * dz) / length
          ))
        : 0;

      const cx = a.x + t * dx;
      const cz = a.z + t * dz;
      const width = a.width + t * (b.width - a.width);

      if (Math.hypot(x - cx, z - cz) <= width + clearance) {
        return false;
      }
    }

    if (insidePolygon(point, pond)) return false;

    for (let i = 0; i < pond.length; i++) {
      const a = pond[i];
      const b = pond[(i + 1) % pond.length];

      if (distanceToSegment(point, a, b) <= clearance) {
        return false;
      }
    }

    return true;
  }

  const gridToWorld = (v: number) =>
    (v - GRID_SIZE / 2) * CELL_SIZE;

  const buildingPlotCache = new Map<string, boolean>();

  function isBuildingPlotValid(
    x: number, z: number, width: number, depth: number
  ) {
    const key = `${x},${z},${width},${depth}`;
    const cached = buildingPlotCache.get(key);
    if (cached !== undefined) return cached;

    const minX = gridToWorld(x);
    const maxX = gridToWorld(x + width);
    const minZ = gridToWorld(z);
    const maxZ = gridToWorld(z + depth);

    const nx = Math.max(1, Math.ceil((maxX - minX) / 0.25));
    const nz = Math.max(1, Math.ceil((maxZ - minZ) / 0.25));

    for (let iz = 0; iz <= nz; iz++) {
      for (let ix = 0; ix <= nx; ix++) {
        const px = minX + (maxX - minX) * ix / nx;
        const pz = minZ + (maxZ - minZ) * iz / nz;

        if (!isLandPoint(px, pz, 0.2)) {
          buildingPlotCache.set(key, false);
          return false;
        }
      }
    }

    buildingPlotCache.set(key, true);
    return true;
  }

  const plantSiteCache = new Map<string, boolean>();

  function isPlantSiteValid(x: number, z: number) {
    const cx = gridToWorld(x + 0.5);
    const cz = gridToWorld(z + 0.5);

    const key = `${x},${z}`;
    const cached = plantSiteCache.get(key);

    if (cached !== undefined) return cached;

    // Modest shoreline margin for small vegetation.
    const valid = isLandPoint(cx, cz, 0.3);

    if (plantSiteCache.size >= 4096) {
      plantSiteCache.clear();
    }

    plantSiteCache.set(key, valid);
    return valid;
  }

  const placement = {
    isLandPoint,
    isBuildingPlotValid,
    isPlantSiteValid
  };

  // Bound cache growth across world resets.
  if (placementCache.size >= 4) {
    const oldest = placementCache.keys().next().value;
    if (oldest !== undefined) placementCache.delete(oldest);
  }

  placementCache.set(seed, placement);
  return placement;
}
