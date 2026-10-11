import TerrariumSky from "./TerrariumSky";
import SkyBubbles from "./SkyBubbles";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  BoxGeometry, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry,
  ExtrudeGeometry, Float32BufferAttribute, IcosahedronGeometry, Matrix4, Shape as ThreeShape, ShapeGeometry, SphereGeometry, TubeGeometry, Vector3,
} from "three";
import type { InstancedMesh } from "three";
import {
  selectActivity, selectBuildings, selectPlants, selectResidents, useWorldStore,
} from "./state/worldStore";
import type { Building, Plant } from "./simulation/types";
import { getDayPhase } from "./simulation/worldDefaults";
import { residentOccupiedPlots } from "./simulation/navigation";
import {
  BOARD_SIZE, BUILDING_CATALOG, BUILDING_GROWTH_SECONDS, CELL_SIZE,
  GRID_SIZE, GROWTH_REFRESH_MS, batchParts, buildingDimensions, buildingModel, buildingProgress,
  cellPoint, clamp01, compose, findFreePlot, findFreePlantSite, growthStage, hasExplicitGrowth,
  hashId, placeModel, plantModel, residentPoint,
} from "./edenModels";
import type { Batch, BuildingVariant, Part, Shape } from "./edenModels";
import "./App.css";
import FastForwardControls from "./FastForwardControls";

// Unit geometries are shared by every instance, including every plant leaf.
// Their lifetime is the renderer module's lifetime; individual batches own only
// their instance buffers and materials, not these shared geometries.
const GEOMETRIES: Record<Shape, BufferGeometry> = {
  box: new BoxGeometry(1, 1, 1),
  sphere: new SphereGeometry(1, 8, 6),
  leaf: new SphereGeometry(1, 6, 4),
  foliage: new IcosahedronGeometry(1, 1),
  // Rotate the unit roof BEFORE stretching it to a rectangular footprint.
  roof: new ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
  gable: createGableGeometry().rotateY(Math.PI / 2),
  cone: new ConeGeometry(1, 1, 8),
  cylinder: new CylinderGeometry(1, 1, 1, 12),
  stem: new CylinderGeometry(0.7, 1, 1, 6),
  capsule: new CapsuleGeometry(0.07, 0.12, 3, 6),
};

function createGableGeometry() {
  // A low, elongated roof with a continuous ridge, matching the cottage forms
  // in the reference while remaining a shared unit geometry for instancing.
  const geometry = new BufferGeometry();
  const triangles = [
    [-.5,-.5,-.5, .5,-.5,-.5, 0,.5,-.5], [.5,-.5,.5, -.5,-.5,.5, 0,.5,.5],
    [-.5,-.5,.5, -.5,-.5,-.5, 0,.5,-.5], [-.5,-.5,.5, 0,.5,-.5, 0,.5,.5],
    [.5,-.5,-.5, .5,-.5,.5, 0,.5,.5], [.5,-.5,-.5, 0,.5,.5, 0,.5,-.5],
    [-.5,-.5,.5, .5,-.5,.5, .5,-.5,-.5], [-.5,-.5,.5, .5,-.5,-.5, -.5,-.5,-.5],
  ];
  geometry.setAttribute("position", new Float32BufferAttribute(triangles.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

const TANK_WIDTH = BOARD_SIZE + 2.2;
const TANK_HEIGHT = BOARD_SIZE * 0.63;
const TANK_RADIUS = 2.4;
// The thick soil bed raises the miniature landscape into the enclosure instead
// of leaving a large unused aquarium-like headspace above a floor-level city.
const TERRAIN_LIFT = 4;
// A near-front three-quarter view matches the reference's display-tank framing:
// the long front pane reads clearly, while enough of the right side remains visible.
const CAMERA_POSITION: [number, number, number] = [BOARD_SIZE * 0.78, BOARD_SIZE * 1.08, BOARD_SIZE * 1.95];
const CAMERA_OPTIONS = { position: CAMERA_POSITION, fov: 34, near: 0.1, far: BOARD_SIZE * 8 };
const DPR_RANGE: [number, number] = [1, 1.25];
const GL_OPTIONS = { antialias: true, powerPreference: "low-power" as const };
const ORBIT_TARGET: [number, number, number] = [0, TANK_HEIGHT * 0.36, 0];
const createRendererId = (type: string) => `${type}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function roundedPerimeter(halfWidth: number, halfDepth: number, radius: number, y: number) {
  const points: Vector3[] = [];
  const corners = [
    { x: halfWidth - radius, z: -halfDepth + radius, from: -90 },
    { x: halfWidth - radius, z: halfDepth - radius, from: 0 },
    { x: -halfWidth + radius, z: halfDepth - radius, from: 90 },
    { x: -halfWidth + radius, z: -halfDepth + radius, from: 180 },
  ];
  for (const corner of corners) for (let step = 0; step <= 10; step++) {
    const angle = (corner.from + step * 9) * Math.PI / 180;
    points.push(new Vector3(corner.x + Math.cos(angle) * radius, y, corner.z + Math.sin(angle) * radius));
  }
  return points;
}

function createTankWallGeometry() {
  const outline = roundedPerimeter(TANK_WIDTH / 2, TANK_WIDTH / 2, TANK_RADIUS, 0);
  const positions: number[] = [], indices: number[] = [];
  for (const point of outline) positions.push(point.x, 0.04, point.z, point.x, TANK_HEIGHT, point.z);
  for (let index = 0; index < outline.length; index++) {
    const next = (index + 1) % outline.length;
    const bottom = index * 2, top = bottom + 1, nextBottom = next * 2, nextTop = nextBottom + 1;
    indices.push(bottom, nextBottom, nextTop, bottom, nextTop, top);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedGroundShape() {
  const half = BOARD_SIZE / 2;
  const radius = 2.1;
  const shape = new ThreeShape();
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half); shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius); shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half); shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius); shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  return shape;
}
const GROUND_GEOMETRY = new ShapeGeometry(createRoundedGroundShape(), 8).rotateX(-Math.PI / 2);
const SOIL_GEOMETRY = new ExtrudeGeometry(createRoundedGroundShape(), { depth: TERRAIN_LIFT - 0.25, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.1, bevelThickness: 0.08, steps: 1 }).rotateX(-Math.PI / 2);

function TankEnclosure({ night }: { night: boolean }) {
  const wall = useMemo(() => createTankWallGeometry(), []);
  const rim = useMemo(() => new TubeGeometry(new CatmullRomCurve3(roundedPerimeter(TANK_WIDTH / 2, TANK_WIDTH / 2, TANK_RADIUS, TANK_HEIGHT), true, "centripetal"), 120, 0.075, 8, true), []);
  const innerRim = useMemo(() => new TubeGeometry(new CatmullRomCurve3(roundedPerimeter(TANK_WIDTH / 2 - 0.14, TANK_WIDTH / 2 - 0.14, TANK_RADIUS - 0.12, TANK_HEIGHT - 0.035), true, "centripetal"), 120, 0.035, 8, true), []);
  const lowerRim = useMemo(() => new TubeGeometry(new CatmullRomCurve3(roundedPerimeter(TANK_WIDTH / 2, TANK_WIDTH / 2, TANK_RADIUS, 0.08), true, "centripetal"), 120, 0.045, 8, true), []);
  const frontGlints = useMemo(() => [-1, 1].map(side => new TubeGeometry(new CatmullRomCurve3([
    new Vector3(side * (TANK_WIDTH / 2 - TANK_RADIUS), 0.25, TANK_WIDTH / 2),
    new Vector3(side * (TANK_WIDTH / 2 - TANK_RADIUS), TANK_HEIGHT - 0.18, TANK_WIDTH / 2),
  ], false), 24, 0.035, 6, false)), []);
  const glintPoints = useMemo(() => {
    const outline = roundedPerimeter(TANK_WIDTH / 2 + 0.005, TANK_WIDTH / 2 + 0.005, TANK_RADIUS, 0);
    return [outline.slice(0, 10), outline.slice(22, 32)].map(points => new TubeGeometry(new CatmullRomCurve3(points, false, "centripetal"), 32, 0.035, 6, false));
  }, []);
  return <group>
    <mesh geometry={wall} renderOrder={4}>
      <meshPhysicalMaterial color={night ? "#8aeafa" : "#b5f5fb"} transparent opacity={night ? 0.2 : 0.18} roughness={0.08} metalness={0} transmission={0.1} thickness={0.24} ior={1.33} side={2} depthWrite={false} />
    </mesh>
    <mesh geometry={rim} renderOrder={6}><meshStandardMaterial color="#ecffff" roughness={0.12} metalness={0.05} emissive="#75f2ff" emissiveIntensity={night ? 0.34 : 0.18} /></mesh>
    <mesh geometry={innerRim} renderOrder={6}><meshStandardMaterial color="#bdffff" roughness={0.08} metalness={0.06} emissive="#5adff0" emissiveIntensity={0.16} /></mesh>
    <mesh geometry={lowerRim} renderOrder={6}><meshStandardMaterial color="#a6f7ff" roughness={0.16} metalness={0.08} emissive="#41d9ee" emissiveIntensity={0.18} /></mesh>
    {glintPoints.map((geometry, index) => <mesh key={index} geometry={geometry} renderOrder={7}><meshBasicMaterial color="#ffffff" transparent opacity={0.68} /></mesh>)}
    {frontGlints.map((geometry, index) => <mesh key={`front-${index}`} geometry={geometry} renderOrder={7}><meshBasicMaterial color="#f3ffff" transparent opacity={0.44} /></mesh>)}
  </group>;
}

function WaterCourse() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const halfWidth = 0.58;
    const steps = 88;
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps, t1 = (step + 1) / steps;
      const z0 = -BOARD_SIZE * 0.48 + t0 * BOARD_SIZE * 0.71;
      const z1 = -BOARD_SIZE * 0.48 + t1 * BOARD_SIZE * 0.71;
      const x0 = -4 + 10 * t0 + Math.sin(t0 * Math.PI * 2) * 2;
      const x1 = -4 + 10 * t1 + Math.sin(t1 * Math.PI * 2) * 2;
      const a = [x0 - halfWidth, 0.065, z0], b = [x0 + halfWidth, 0.065, z0];
      const c = [x1 + halfWidth, 0.065, z1], d = [x1 - halfWidth, 0.065, z1];
      positions.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.computeVertexNormals();
    return result;
  }, []);
  return <group>
    <mesh geometry={geometry} receiveShadow><meshPhysicalMaterial color="#21cce2" roughness={0.11} metalness={0.06} clearcoat={1} clearcoatRoughness={0.08} emissive="#19a9bd" emissiveIntensity={0.1} /></mesh>
    <mesh position={[6, 0.073, BOARD_SIZE * 0.29]} scale={[3.3, 0.075, 1.85]} receiveShadow><sphereGeometry args={[1, 32, 16]} /><meshPhysicalMaterial color="#35d8e8" roughness={0.08} metalness={0.08} clearcoat={1} emissive="#10a8bd" emissiveIntensity={0.12} /></mesh>
    {[0, 1, 2].map(index => <mesh key={index} position={[6, 0.153 + index * 0.002, BOARD_SIZE * 0.29]} scale={[2.25 + index * 0.35, 1.12 + index * 0.22, 1]} rotation={[-Math.PI / 2, 0, index * 0.35]}><ringGeometry args={[0.91, 1, 64]} /><meshBasicMaterial color={index === 1 ? "#d6ffff" : "#76f4ff"} transparent opacity={0.48} side={2} /></mesh>)}
  </group>;
}

function MossBanks({ night }: { night: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree(state => state.invalidate);
  const geometry = useMemo(() => new SphereGeometry(1, 12, 8), []);
  const patches = useMemo(() => Array.from({ length: 176 }, (_, index) => {
    const angle = index / 136 * Math.PI * 2;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const edge = (BOARD_SIZE * (0.41 + ((index * 17) % 10) / 100)) / Math.max(Math.abs(cosine), Math.abs(sine));
    if (index >= 136) {
      const waterAngle = (index - 136) / 40 * Math.PI * 2;
      return { x: 6 + Math.cos(waterAngle) * (3.7 + (index % 3) * 0.16), z: BOARD_SIZE * 0.29 + Math.sin(waterAngle) * (2.15 + (index % 4) * 0.13), sx: 0.62 + index % 3 * 0.12, sz: 0.57 + index % 4 * 0.1, color: index % 2 };
    }
    return { x: cosine * edge, z: sine * edge, sx: 0.74 + (index * 7 % 9) * 0.105, sz: 0.72 + (index * 5 % 8) * 0.11, color: index % 4 };
  }), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const colors = ["#47b85b", "#55c564", "#68ce69", "#3da857"];
    patches.forEach((patch, index) => {
      matrix.makeScale(patch.sx, 0.13 + index % 3 * 0.018, patch.sz).setPosition(patch.x, 0.075, patch.z);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new Color(colors[patch.color]!));
    });
    mesh.count = patches.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [patches, invalidate]);
  return <instancedMesh ref={ref} args={[geometry, undefined, patches.length]} receiveShadow>
    <meshStandardMaterial color={night ? "#c0e4c9" : "#ffffff"} roughness={0.88} />
  </instancedMesh>;
}
const PANEL_STYLE: CSSProperties = {
  position: "absolute", top: 12, left: 12, zIndex: 10,
  display: "flex", flexDirection: "column", gap: 8, width: 224,
  maxHeight: "calc(100vh - 24px)", overflowY: "auto",
  padding: 12, borderRadius: 14, boxSizing: "border-box",
  background: "rgba(12, 40, 45, 0.9)", color: "#e8f5df",
  border: "1px solid rgba(190, 230, 204, 0.3)", fontSize: 12,
};
const CONTROL_STYLE: CSSProperties = {
  borderRadius: 7, border: "1px solid #779e8b", padding: "7px 9px",
  background: "#dcebd8", color: "#183e38", font: "inherit",
};

/** A single draw batch for one geometry/material combination. */
const InstanceBatch = memo(function InstanceBatch({ batch, night }: { batch: Batch; night: boolean }) {
  const meshRef = useRef<InstancedMesh>(null);
  const invalidate = useThree(state => state.invalidate);
  // Spare capacity limits GPU buffer recreation as new objects are added.
  const capacity = Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, batch.parts.length))));

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const color = new Color();
    mesh.count = batch.parts.length;
    batch.parts.forEach((part, index) => {
      mesh.setMatrixAt(index, matrix.fromArray(part.matrix));
      mesh.setColorAt(index, color.set(part.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Includes distant plots after additions, movement, or growth.
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    invalidate();
  }, [batch.parts, capacity, invalidate]);

  const glass = batch.finish === "glass";
  const greenhouse = batch.finish === "greenhouse";
  const solar = batch.finish === "solar";
  const metal = batch.finish === "metal";

  return (
    <instancedMesh
      ref={meshRef}
      args={[GEOMETRIES[batch.shape], undefined, capacity]}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        color="#ffffff"
        transparent={glass || greenhouse}
        opacity={glass ? 0.4 : greenhouse ? 0.18 : 1}
        depthWrite={!glass && !greenhouse}
        side={2}
        roughness={glass || greenhouse ? 0.12 : solar ? 0.2 : metal ? 0.32 : 0.78}
        metalness={glass || greenhouse ? 0.04 : solar ? 0.3 : metal ? 0.36 : 0}
        emissive={glass ? "#fff0ab" : greenhouse ? "#8af5df" : "#000000"}
        emissiveIntensity={glass ? (night ? 0.58 : 0.16) : greenhouse ? (night ? 0.12 : 0.045) : 0}
        clearcoat={glass || greenhouse ? 0.7 : solar ? 0.9 : 0.12}
        clearcoatRoughness={glass || greenhouse ? 0.06 : solar ? 0.12 : 0.32}
        flatShading={!glass && !greenhouse && !metal}
      />
    </instancedMesh>
  );
});

function BatchLayer({ batches, night }: { batches: Batch[]; night: boolean }) {
  return <>{batches.map(batch => <InstanceBatch key={batch.key} batch={batch} night={night} />)}</>;
}

/** Store growth overrides age-based growth if the simulation supplies it. */
function BuildingsLayer({ night }: { night: boolean }) {
  const buildings = useWorldStore(selectBuildings);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const growing = buildings.filter(item => !hasExplicitGrowth(item) && buildingProgress(item, Date.now()) < 1);
    if (growing.length === 0) return;
    const timer = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (growing.every(item => buildingProgress(item, next) >= 1)) window.clearInterval(timer);
    }, GROWTH_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [buildings]);

  const batches = useMemo(() => {
    const parts: Part[] = [];
    for (const item of buildings) {
      const at = cellPoint(
        item.gridPosition.x + (item.footprint.width - 1) / 2,
        item.gridPosition.z + (item.footprint.depth - 1) / 2,
      );
      // Footprints are occupied grid dimensions. A quarter-turn swaps the local
      // dimensions so a rectangular building still fits its recorded plot.
      const { width, depth } = buildingDimensions(item.footprint, item.rotation);
      const progress = buildingProgress(item, now);
      const stage = growthStage(progress);
      const model = buildingModel(item.variantId, width, depth, stage, hashId(item.id), item.floors, item.moss);
      // Horizontal size stays fixed so growth cannot consume neighboring plots.
      const buildingVariation = 0.75 + (hashId(item.id) % 100) / 100 * 0.8;
    const root = compose(
      [at.x, 0, at.z],
      [0, item.rotation, 0],
      [1, (0.65 + progress * 0.35) * buildingVariation, 1]
    );
      placeModel(model, root, parts);

      // Climbing vines and leaves appear as moss increases.
      const moss = Math.max(0, Math.min(1, item.moss ?? 0));

      if (moss > 0.05) {
        const height = (item.floors ?? 1) * 0.55 + 0.5;
        const vineCount = Math.ceil(moss * 12);

        for (let i = 0; i < vineCount; i++) {
          const side = i % 4;
          const fraction = ((i * 7) % 11) / 11 - 0.5;

          const localX =
            side < 2
              ? fraction * width * 0.85
              : (side === 2 ? -1 : 1) * width * 0.46;

          const localZ =
            side < 2
              ? (side === 0 ? -1 : 1) * depth * 0.46
              : fraction * depth * 0.85;

          const angle = item.rotation;

          const x =
            at.x +
            localX * Math.cos(angle) +
            localZ * Math.sin(angle);

          const z =
            at.z -
            localX * Math.sin(angle) +
            localZ * Math.cos(angle);

          const vineHeight =
            height * moss * (0.5 + (i % 4) * 0.12);

          parts.push({
            shape: "stem",
            finish: "matte",
            color: i % 3 === 0 ? "#397b3c" : "#4d9b4a",
            matrix: compose(
              [x, vineHeight / 2, z],
              [0, 0, 0],
              [
                0.035 + moss * 0.035,
                vineHeight,
                0.035 + moss * 0.035,
              ]
            ),
          });

          const leafCount = Math.ceil(moss * 6);

          for (let j = 0; j < leafCount; j++) {
            const leafY =
              ((j + 1) / (leafCount + 1)) * vineHeight;

            parts.push({
              shape: "leaf",
              finish: "matte",
              color: j % 2 === 0 ? "#56a94c" : "#7bc768",
              matrix: compose(
                [
                  x + (j % 2 === 0 ? -0.06 : 0.06),
                  leafY,
                  z,
                ],
                [0, 0, j % 2 === 0 ? -0.5 : 0.5],
                [
                  0.09 + moss * 0.06,
                  0.045 + moss * 0.035,
                  0.065,
                ]
              ),
            });
          }
        }
      }

    }
    return batchParts(parts);
  }, [buildings, now]);

  return <BatchLayer batches={batches} night={night} />;
}

function PlantsLayer({ night }: { night: boolean }) {
  const plants = useWorldStore(selectPlants);
  const batches = useMemo(() => {
    const parts: Part[] = [];
    for (const item of plants) {
      const at = cellPoint(item.gridPosition.x, item.gridPosition.z);
      const seed = hashId(item.id);
      const speciesScale = item.species === "tree" ? 2.2 : item.species === "shrub" ? 1.6 : 1.35;
      const growth = Math.max(0, Math.min(3, item.growth));

    const natureMultiplier =
      item.species === "tree" ? 1.65 :
      item.species === "shrub" ? 1.4 :
      item.species === "fern" ? 1.35 :
      item.species === "flower" ? 1.5 :
      1.25;

    const individualSize = 0.7 + (seed % 100) / 100 * 0.9;

    const scale =
      (0.25 + growth * 0.65) *
      individualSize *
      (CELL_SIZE / 1.5) *
      speciesScale *
      natureMultiplier;
      const root = compose([at.x, 0, at.z], [0, seed % 360 * Math.PI / 180, 0], [scale, scale, scale]);
      placeModel(plantModel(item.species, seed), root, parts);
    }
    return batchParts(parts);
  }, [plants]);
  return <BatchLayer batches={batches} night={night} />;
}

function ResidentsLayer({ night }: { night: boolean }) {
  const residents = useWorldStore(selectResidents);
  const batches = useMemo(() => {
    const parts: Part[] = [];
    for (const item of residents) {
      if (item.activity === "resting") continue;
      const at = residentPoint(item.position.x, item.position.z);
      parts.push({ shape: "capsule", finish: "matte", color: "#9b9d98", matrix: compose([at.x, 0.13, at.z]) });
    }
    return batchParts(parts);
  }, [residents]);
  return <BatchLayer batches={batches} night={night} />;
}

function useNight() {
  const simulationTime = useWorldStore(state => state.world.simulationTime);
  return getDayPhase(simulationTime) === "night";
}

const World = memo(function World({ showGrid, shadows }: { showGrid: boolean; shadows: boolean }) {
  const night = useNight();
  const weather = useWorldStore(state => state.world.weather);
  const simulationTime = useWorldStore(state => state.world.simulationTime);
  const phase = getDayPhase(simulationTime);
  const sky = weather.condition === "rainy" ? (night ? "#263c4a" : "#d7e5dc") : weather.condition === "cloudy" ? (night ? "#263f4a" : "#d3e9e7") : phase === "sunset" ? "#ffd6a2" : (night ? "#102b36" : "#bceaf1");
  return (
    <>
      <color attach="background" args={[sky]} />
      {/* Start beyond the map at the default view; avoids washing out buildings. */}
      <fog attach="fog" args={[sky, BOARD_SIZE * 3.5, BOARD_SIZE * 6]} />
      <hemisphereLight args={[night ? "#82d6ff" : "#f5ffff", night ? "#184b55" : "#63c579", night ? 0.7 : 0.82]} />
      <ambientLight intensity={weather.condition === "rainy" ? 0.58 : weather.condition === "cloudy" ? 0.82 : night ? 0.7 : 1.02} color={night ? "#83b5dc" : "#eaffff"} />
      <directionalLight
        position={[-BOARD_SIZE * 0.6, BOARD_SIZE, BOARD_SIZE * 0.6]}
        intensity={weather.condition === "rainy" ? 0.72 : weather.condition === "cloudy" ? 1.25 : phase === "sunset" ? 1.55 : night ? 0.65 : 2.25}
        color={night ? "#9bc7ff" : phase === "sunset" ? "#ffe0b5" : "#ffffff"}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-BOARD_SIZE * 0.75}
        shadow-camera-right={BOARD_SIZE * 0.75}
        shadow-camera-top={BOARD_SIZE * 0.75}
        shadow-camera-bottom={-BOARD_SIZE * 0.75}
        shadow-camera-near={0.5}
        shadow-camera-far={BOARD_SIZE * 4}
        shadow-normalBias={0.03}
      />
      <group position={[0, TERRAIN_LIFT, 0]}>
      <mesh position={[0, -TERRAIN_LIFT + 0.12, 0]} receiveShadow castShadow geometry={SOIL_GEOMETRY}>
        <meshStandardMaterial color={night ? "#4a3429" : "#573722"} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.004, 0]} receiveShadow geometry={GROUND_GEOMETRY}>
        <meshStandardMaterial color={night ? "#299a6c" : "#3ca959"} roughness={0.76} />
      </mesh>
      <MossBanks night={night} />
      <WaterCourse />
      {showGrid && <gridHelper args={[BOARD_SIZE, GRID_SIZE, night ? "#5e9c96" : "#b4e2cc", night ? "#376c6d" : "#8bc8ae"]} position={[0, 0.04, 0]} />}
      <TankEnclosure night={night} />
      {weather.condition === "cloudy" && Array.from({ length: 5 }, (_, index) => (
        <group key={`cloud-${index}`} position={[(index - 2) * BOARD_SIZE * 0.13, BOARD_SIZE * (0.34 + index % 2 * 0.035), ((index * 7) % 5 - 2) * BOARD_SIZE * 0.12]}>
          <mesh><sphereGeometry args={[BOARD_SIZE * 0.055, 8, 6]} /><meshBasicMaterial color="#f5fffb" transparent opacity={0.2} depthWrite={false} /></mesh>
          <mesh position={[BOARD_SIZE * 0.045, -BOARD_SIZE * 0.008, BOARD_SIZE * 0.01]}><sphereGeometry args={[BOARD_SIZE * 0.045, 8, 6]} /><meshBasicMaterial color="#f5fffb" transparent opacity={0.18} depthWrite={false} /></mesh>
        </group>
      ))}
      {weather.condition === "rainy" && Array.from({ length: 42 }, (_, index) => {
        const elapsed = Math.floor(simulationTime * 3);
        const x = ((index * 23 + elapsed * 7) % 100) / 100 * BOARD_SIZE - BOARD_SIZE / 2;
        const z = ((index * 41 + elapsed * 11) % 100) / 100 * BOARD_SIZE - BOARD_SIZE / 2;
        const y = 0.5 + ((index * 13 + elapsed * 29) % 100) / 100 * BOARD_SIZE * 0.48;
        return <mesh key={index} position={[x, y, z]} rotation={[0.12, 0, 0.08]}><cylinderGeometry args={[0.012, 0.012, 0.32, 4]} /><meshBasicMaterial color="#c7f4f1" transparent opacity={0.65} /></mesh>;
      })}
      <BuildingsLayer night={night} />
      <PlantsLayer night={night} />
      <ResidentsLayer night={night} />
      </group>
      <OrbitControls
        enablePan
        minDistance={CELL_SIZE * 4}
        maxDistance={BOARD_SIZE * 3}
        maxPolarAngle={Math.PI / 2.15}
        target={ORBIT_TARGET}
      />
    </>
  );
});

function App() {
    const setSystemIdle = useWorldStore(
    (state) => state.setSystemIdle
  );

  useEffect(() => {
    const api = window.edenAPI;

    if (!api) return;

    let mounted = true;
    let latestTimestamp = -Infinity;

    const handleActivity = (activity: {
      status: "active" | "idle";
      timestamp: number;
    }) => {
      if (!mounted || activity.timestamp < latestTimestamp) return;

      latestTimestamp = activity.timestamp;
      setSystemIdle(activity.status === "idle");
    };

    const unsubscribe = api.onActivityChanged(handleActivity);

    api.getCurrentActivity()
      .then((activity) => {
        if (activity) handleActivity(activity);
      })
      .catch(console.error);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setSystemIdle]);

  // Simulation timer and activity tracking
  const advanceTime = useWorldStore(state => state.advanceTime);
  const recordInput = useWorldStore(state => state.recordInput);
  const setActivityCategory = useWorldStore(state => state.setActivityCategory);
  const addBuilding = useWorldStore(state => state.addBuilding);
  const addPlant = useWorldStore(state => state.addPlant);
  const resetWorld = useWorldStore(state => state.resetWorld);
  // Primitive subscriptions keep the toolbar out of world movement/growth updates.
  const activityCategory = useWorldStore(state => selectActivity(state).category);
  const buildingCount = useWorldStore(state => selectBuildings(state).length);
  const plantCount = useWorldStore(state => selectPlants(state).length);
  const worldActivity = useWorldStore(selectActivity);
  const weather = useWorldStore(state => state.world.weather);
  const simulationTime = useWorldStore(state => state.world.simulationTime);
  const [variant, setVariant] = useState<BuildingVariant>("solar-house");
  const [plantType, setPlantType] = useState<Plant["species"]>("tree");
  const [panelOpen, setPanelOpen] = useState(false);
  const [windowHovered, setWindowHovered] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [shadows, setShadows] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let previous = Date.now();
    let lastInput = 0;
    const timer = window.setInterval(() => {
      const now = Date.now();
      advanceTime(Math.max(0, now - previous) / 1_000, now);
      previous = now;
    }, 1_000);
    const onInput = (event: Event) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && (target.isContentEditable || !!target.closest("input, textarea, select"));
      if (!editing && event instanceof KeyboardEvent && event.altKey && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
        event.preventDefault();
        recordInput();
        setActivityCategory(event.code === "Digit1" ? "productivity" : event.code === "Digit2" ? "leisure" : "idle");
        return;
      }
      // Wheel events can arrive dozens of times per second.
      const now = Date.now();
      // Only track window input when running in a browser.
      // Electron already tracks activity across the entire Mac.
      if (!window.edenAPI) {
        if (now - lastInput >= 200) { recordInput(); lastInput = now; }
      }
    };
    window.addEventListener("pointerdown", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    window.addEventListener("wheel", onInput, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("wheel", onInput);
    };
  }, [advanceTime, recordInput, setActivityCategory]);
  
  function handleAddBuilding() {
    const config = BUILDING_CATALOG.find(entry => entry.id === variant)!;
    // Read current state at click time, including rapid successive additions.
    const state = useWorldStore.getState();
    const residents = residentOccupiedPlots(selectResidents(state));
    const plot = findFreePlot([...selectBuildings(state), ...residents], selectPlants(state), config.width, config.depth);
    if (!plot) { setNotice(`No empty ${config.width}×${config.depth} plot remains.`); return; }
    const item: Building = {
      type: "building", id: createRendererId("building"), variantId: config.id, name: config.name,
      gridPosition: plot, footprint: { width: config.width, depth: config.depth },
      rotation: 0, createdAt: Date.now(),
    };
    try {
      addBuilding(item);
      const accepted = selectBuildings(useWorldStore.getState()).some(building => building.id === item.id);
      setNotice(accepted ? `${config.name} added. It grows over ${BUILDING_GROWTH_SECONDS / 60} minutes.` : "The store rejected this building. Update its grid limits and variant catalog.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The building could not be added.");
    }
  }

  function handleAddPlant() {
    const state = useWorldStore.getState();
    const residents = residentOccupiedPlots(selectResidents(state));
    const position = findFreePlantSite([...selectBuildings(state), ...selectPlants(state), ...residents]);
    if (!position) { setNotice("No suitable planting space remains."); return; }
    addPlant({ type: "plant", id: createRendererId("plant"), species: plantType, variantId: plantType, gridPosition: position, growth: 0.9, createdAt: Date.now() });
    setNotice(`${plantType} added.`);
  }

  return (
    <main
      className="app"
      style={{ position: "relative", width: "100vw", height: "100vh" }}
      onPointerEnter={() => setWindowHovered(true)}
      onPointerLeave={() => setWindowHovered(false)}
    >
      <Canvas
        shadows={shadows}
        frameloop="always"
        camera={CAMERA_OPTIONS}
        dpr={DPR_RANGE}
        gl={GL_OPTIONS}
      >
        <TerrariumSky />
        <SkyBubbles />
        <World showGrid={showGrid} shadows={shadows} />
      </Canvas>
      <div style={{
        ...PANEL_STYLE,
        position: "absolute",
        top: 40,
        right: "auto",
        bottom: "auto",
        left: 18,
        zIndex: 100,
        display: windowHovered || panelOpen ? "flex" : "none",
        flexDirection: "column-reverse",
        gap: 8,
        maxHeight: "calc(100vh - 36px)",
        overflowY: "auto",
        ...(panelOpen ? {} : { width: "auto", padding: 7 }),
      }}>
        <button type="button" style={CONTROL_STYLE} onClick={() => setPanelOpen(open => !open)} aria-expanded={panelOpen} aria-controls="eden-building-panel">
          {panelOpen ? "Close controls" : "Build"}
        </button>
        {panelOpen && <div id="eden-building-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>{GRID_SIZE}×{GRID_SIZE} map · {buildingCount} buildings · {plantCount} plants</strong>
          <small>Productivity {worldActivity.productivityPoints.toFixed(1)} · Leisure {worldActivity.leisurePoints.toFixed(1)} · Idle {worldActivity.idlePoints.toFixed(1)} points</small>
          <small>{weather.condition} · {getDayPhase(simulationTime)} · 10 minute cycle</small>
          <label htmlFor="eden-building-type">Building type</label>
          <select id="eden-building-type" value={variant} onChange={event => setVariant(event.target.value as BuildingVariant)} style={CONTROL_STYLE}>
            {BUILDING_CATALOG.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.width}×{entry.depth}</option>)}
          </select>
          <button type="button" onClick={handleAddBuilding} style={CONTROL_STYLE}>Add building</button>
          <label htmlFor="eden-plant-type">Plant type</label>
          <select id="eden-plant-type" value={plantType} onChange={event => setPlantType(event.target.value as Plant["species"])} style={CONTROL_STYLE}>
            {["tree", "shrub", "fern", "flower", "grass"].map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <button type="button" onClick={handleAddPlant} style={CONTROL_STYLE}>Add plant</button>
          <FastForwardControls />
          <label><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)} /> Show grid</label>
          <label><input type="checkbox" checked={shadows} onChange={event => setShadows(event.target.checked)} /> Shadows</label>
          <button type="button" style={CONTROL_STYLE} onClick={() => {
            if (window.confirm("Reset the entire world?")) { resetWorld(); setNotice("World reset."); }
          }}>Reset world</button>
          <small>New buildings grow through starter, expanded, and mature stages.</small>
          <span role="status" style={{ lineHeight: 1.4 }}>{notice}</span>
        </div>}
      </div>
      <div className="wordmark">EDEN<span>.EXE</span></div>
      <div className="status"><i className={activityCategory} />{activityCategory}</div>
    </main>
  );
}

export default App;