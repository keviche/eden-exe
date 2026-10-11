import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry,
  IcosahedronGeometry, Matrix4, SphereGeometry,
} from "three";
import type { BufferGeometry, InstancedMesh } from "three";
import {
  selectActivity, selectBuildings, selectPlants, selectResidents, useWorldStore,
} from "./state/worldStore";
import type { Building } from "./simulation/types";
import {
  BOARD_SIZE, BUILDING_CATALOG, BUILDING_GROWTH_SECONDS, CELL_SIZE,
  GRID_SIZE, GROWTH_REFRESH_MS, batchParts, buildingDimensions, buildingModel, buildingProgress,
  cellPoint, clamp01, compose, findFreePlot, growthStage, hasExplicitGrowth,
  hashId, placeModel, plantModel, residentPoint,
} from "./edenModels";
import type { Batch, BuildingVariant, Part, Shape } from "./edenModels";
import "./App.css";

// Nine unit geometries are shared by every instance, including every plant leaf.
// Their lifetime is the renderer module's lifetime; individual batches own only
// their instance buffers and materials, not these shared geometries.
const GEOMETRIES: Record<Shape, BufferGeometry> = {
  box: new BoxGeometry(1, 1, 1),
  sphere: new SphereGeometry(1, 8, 6),
  leaf: new SphereGeometry(1, 6, 4),
  foliage: new IcosahedronGeometry(1, 1),
  // Rotate the unit roof BEFORE stretching it to a rectangular footprint.
  roof: new ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
  cone: new ConeGeometry(1, 1, 8),
  cylinder: new CylinderGeometry(1, 1, 1, 12),
  stem: new CylinderGeometry(0.7, 1, 1, 6),
  capsule: new CapsuleGeometry(0.07, 0.12, 3, 6),
};

const CAMERA_POSITION: [number, number, number] = [BOARD_SIZE * 1.1, BOARD_SIZE, BOARD_SIZE * 1.3];
const CAMERA_OPTIONS = { position: CAMERA_POSITION, fov: 42, near: 0.1, far: BOARD_SIZE * 8 };
const DPR_RANGE: [number, number] = [1, 1.25];
const GL_OPTIONS = { antialias: true, powerPreference: "low-power" as const };
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];
const PANEL_STYLE: CSSProperties = {
  position: "absolute", top: 12, left: 12, zIndex: 10,
  display: "flex", flexDirection: "column", gap: 8, width: 224,
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
      <meshStandardMaterial
        color="#ffffff"
        roughness={glass || greenhouse ? 0.2 : solar ? 0.27 : metal ? 0.4 : 0.88}
        metalness={glass || greenhouse ? 0.08 : solar ? 0.25 : metal ? 0.4 : 0}
        emissive={glass ? "#ffe7ae" : greenhouse ? "#66b89a" : "#000000"}
        emissiveIntensity={glass ? (night ? 0.6 : 0.1) : greenhouse ? (night ? 0.08 : 0.025) : 0}
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
    const time = Date.now();
    setNow(time);
    const growing = buildings.filter(item => !hasExplicitGrowth(item) && buildingProgress(item, time) < 1);
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
      const model = buildingModel(item.variantId, width, depth, stage, hashId(item.id));
      // Horizontal size stays fixed so growth cannot consume neighboring plots.
      const root = compose([at.x, 0, at.z], [0, item.rotation, 0], [1, 0.8 + progress * 0.2, 1]);
      placeModel(model, root, parts);
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
      const scale = (0.3 + clamp01(item.growth) * 0.7) * (0.9 + seed % 11 * 0.02) * CELL_SIZE / 1.5;
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
    const shirts = ["#e9b66e", "#88b8a1", "#bb9abe", "#c57e70"];
    for (const item of residents) {
      const at = residentPoint(item.position.x, item.position.z);
      parts.push({ shape: "capsule", finish: "matte", color: shirts[hashId(item.id) % shirts.length]!, matrix: compose([at.x, 0.13, at.z]) });
      parts.push({ shape: "sphere", finish: "matte", color: "#e3bb94", matrix: compose([at.x, 0.29, at.z], [0, 0, 0], [0.066, 0.066, 0.066]) });
    }
    return batchParts(parts);
  }, [residents]);
  return <BatchLayer batches={batches} night={night} />;
}

function useNight() {
  const isNight = () => { const hour = new Date().getHours(); return hour < 6 || hour >= 19; };
  const [night, setNight] = useState(isNight);
  useEffect(() => {
    const update = () => setNight(isNight());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  return night;
}

const World = memo(function World({ showGrid, shadows }: { showGrid: boolean; shadows: boolean }) {
  const night = useNight();
  const sky = night ? "#102b36" : "#a9d9d5";
  return (
    <>
      <color attach="background" args={[sky]} />
      {/* Start beyond the map at the default view; avoids washing out buildings. */}
      <fog attach="fog" args={[sky, BOARD_SIZE * 3.5, BOARD_SIZE * 6]} />
      <ambientLight intensity={night ? 0.7 : 0.9} color={night ? "#83b5dc" : "#fff2cf"} />
      <directionalLight
        position={[-BOARD_SIZE * 0.6, BOARD_SIZE, BOARD_SIZE * 0.6]}
        intensity={night ? 0.65 : 2}
        color={night ? "#9bc7ff" : "#fff4d1"}
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color={night ? "#366b70" : "#72b6a0"} roughness={0.95} />
      </mesh>
      {showGrid && <gridHelper args={[BOARD_SIZE, GRID_SIZE, night ? "#5e9c96" : "#b4e2cc", night ? "#376c6d" : "#8bc8ae"]} position={[0, -0.025, 0]} />}
      <BuildingsLayer night={night} />
      <PlantsLayer night={night} />
      <ResidentsLayer night={night} />
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
  const advanceTime = useWorldStore(state => state.advanceTime);
  const recordInput = useWorldStore(state => state.recordInput);
  const setActivityCategory = useWorldStore(state => state.setActivityCategory);
  const addBuilding = useWorldStore(state => state.addBuilding);
  const resetWorld = useWorldStore(state => state.resetWorld);
  // Primitive subscriptions keep the toolbar out of world movement/growth updates.
  const activityCategory = useWorldStore(state => selectActivity(state).category);
  const buildingCount = useWorldStore(state => selectBuildings(state).length);
  const [variant, setVariant] = useState<BuildingVariant>("solar-house");
  const [panelOpen, setPanelOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
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
      if (now - lastInput >= 200) { recordInput(); lastInput = now; }
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
    const plot = findFreePlot(selectBuildings(state), selectPlants(state), config.width, config.depth);
    if (!plot) { setNotice(`No empty ${config.width}×${config.depth} plot remains.`); return; }
    const item: Building = {
      type: "building", id: crypto.randomUUID(), variantId: config.id, name: config.name,
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

  return (
    <main className="app" style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Canvas
        shadows={shadows}
        frameloop="demand"
        camera={CAMERA_OPTIONS}
        dpr={DPR_RANGE}
        gl={GL_OPTIONS}
      >
        <World showGrid={showGrid} shadows={shadows} />
      </Canvas>
      <div style={panelOpen ? PANEL_STYLE : { ...PANEL_STYLE, width: "auto", padding: 7 }}>
        <button type="button" style={CONTROL_STYLE} onClick={() => setPanelOpen(open => !open)} aria-expanded={panelOpen} aria-controls="eden-building-panel">
          {panelOpen ? "Close controls" : "Build"}
        </button>
        {panelOpen && <div id="eden-building-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>{GRID_SIZE}×{GRID_SIZE} map · {buildingCount} buildings</strong>
          <label htmlFor="eden-building-type">Building type</label>
          <select id="eden-building-type" value={variant} onChange={event => setVariant(event.target.value as BuildingVariant)} style={CONTROL_STYLE}>
            {BUILDING_CATALOG.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.width}×{entry.depth}</option>)}
          </select>
          <button type="button" onClick={handleAddBuilding} style={CONTROL_STYLE}>Add building</button>
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