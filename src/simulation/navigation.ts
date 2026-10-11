import type { Building, GridPosition, Plant, Resident, WorldPosition } from "./types";
import { GRID_SIZE } from "../edenModels";

const cellIndex = (x: number, z: number) => z * GRID_SIZE + x;
const validCell = ({ x, z }: GridPosition) => Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < GRID_SIZE && z < GRID_SIZE;

function blockedCells(buildings: readonly Building[], plants: readonly Plant[]): Uint8Array {
  const blocked = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (const building of buildings) {
    const quarterTurn = Math.abs(Math.round(building.rotation / (Math.PI / 2))) % 2 === 1;
    const width = quarterTurn ? building.footprint.depth : building.footprint.width;
    const depth = quarterTurn ? building.footprint.width : building.footprint.depth;
    for (let z = Math.max(0, Math.floor(building.gridPosition.z)); z < Math.min(GRID_SIZE, Math.ceil(building.gridPosition.z + depth)); z++) {
      for (let x = Math.max(0, Math.floor(building.gridPosition.x)); x < Math.min(GRID_SIZE, Math.ceil(building.gridPosition.x + width)); x++) blocked[cellIndex(x, z)] = 1;
    }
  }
  for (const plant of plants) {
    for (let z = Math.max(0, Math.floor(plant.gridPosition.z - 0.5)); z < Math.min(GRID_SIZE, Math.ceil(plant.gridPosition.z + 0.5)); z++) {
      for (let x = Math.max(0, Math.floor(plant.gridPosition.x - 0.5)); x < Math.min(GRID_SIZE, Math.ceil(plant.gridPosition.x + 0.5)); x++) {
        if (Math.hypot(x + 0.5 - plant.gridPosition.x, z + 0.5 - plant.gridPosition.z) < 0.72) blocked[cellIndex(x, z)] = 1;
      }
    }
  }
  return blocked;
}

export function residentGridPosition(position: WorldPosition): GridPosition {
  return { x: Math.max(0, Math.min(GRID_SIZE - 1, Math.round(position.x / 2 + GRID_SIZE / 2 - 0.5))), z: Math.max(0, Math.min(GRID_SIZE - 1, Math.round(position.z / 2 + GRID_SIZE / 2 - 0.5))) };
}

export function residentWorldPosition(cell: GridPosition): WorldPosition {
  return { x: (cell.x + 0.5 - GRID_SIZE / 2) * 2, y: 0, z: (cell.z + 0.5 - GRID_SIZE / 2) * 2 };
}

export function residentOccupiedPlots(residents: readonly Resident[]): Array<{ gridPosition: GridPosition; footprint: { width: number; depth: number } }> {
  return residents.flatMap(resident => [residentGridPosition(resident.position), ...(resident.route ?? [])].map(gridPosition => ({ gridPosition, footprint: { width: 1, depth: 1 } })));
}

export function findResidentPath(start: GridPosition, target: GridPosition, buildings: readonly Building[], plants: readonly Plant[]): GridPosition[] | null {
  if (!validCell(start) || !validCell(target)) return null;
  const blocked = blockedCells(buildings, plants);
  const startIndex = cellIndex(start.x, start.z), targetIndex = cellIndex(target.x, target.z);
  blocked[startIndex] = 0;
  if (blocked[targetIndex]) return null;
  const previous = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1);
  const queue = new Int16Array(GRID_SIZE * GRID_SIZE);
  let read = 0, write = 0;
  queue[write++] = startIndex;
  previous[startIndex] = startIndex;
  while (read < write) {
    const current = queue[read++]!;
    if (current === targetIndex) break;
    const x = current % GRID_SIZE, z = Math.floor(current / GRID_SIZE);
    for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      if (nx < 0 || nz < 0 || nx >= GRID_SIZE || nz >= GRID_SIZE) continue;
      const next = cellIndex(nx!, nz!);
      if (blocked[next] || previous[next] !== -1) continue;
      previous[next] = current;
      queue[write++] = next;
    }
  }
  if (previous[targetIndex] === -1) return null;
  const route: GridPosition[] = [];
  for (let current = targetIndex; current !== startIndex; current = previous[current]!) route.push({ x: current % GRID_SIZE, z: Math.floor(current / GRID_SIZE) });
  return route.reverse();
}

export function findOpenResidentCell(buildings: readonly Building[], plants: readonly Plant[], residents: readonly WorldPosition[], random: () => number = Math.random): GridPosition | null {
  const blocked = blockedCells(buildings, plants);
  for (const position of residents) {
    const cell = residentGridPosition(position);
    for (let z = Math.max(0, cell.z - 1); z <= Math.min(GRID_SIZE - 1, cell.z + 1); z++) {
      for (let x = Math.max(0, cell.x - 1); x <= Math.min(GRID_SIZE - 1, cell.x + 1); x++) blocked[cellIndex(x, z)] = 1;
    }
  }
  const available: GridPosition[] = [];
  for (let z = 0; z < GRID_SIZE; z++) for (let x = 0; x < GRID_SIZE; x++) if (!blocked[cellIndex(x, z)]) available.push({ x, z });
  if (!available.length) return null;
  return available[Math.min(available.length - 1, Math.floor(random() * available.length))]!;
}
