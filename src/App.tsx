
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import {
  selectActivity,
  selectBuildings,
  selectPlants,
  selectResidents,
  useWorldStore,
} from "./state/worldStore";

import type {
  Building,
  BuildingKind,
  Plant,
  Resident,
} from "./simulation/types";

import "./App.css";

// --------------------------------------------------
// World dimensions
// --------------------------------------------------

const BOARD_SIZE = 9;
const GRID_SIZE = 6;
const ISLAND_RADIUS = 6.4;

// --------------------------------------------------
// Building definitions
// --------------------------------------------------

const BUILDING_TYPES: {
  kind: BuildingKind;
  name: string;
  variantId: string;
}[] = [
  {
    kind: "house",
    name: "Canopy House",
    variantId: "canopy-house",
  },
  {
    kind: "workshop",
    name: "Solar Workshop",
    variantId: "solar-workshop",
  },
  {
    kind: "school",
    name: "School",
    variantId: "school",
  },
  {
    kind: "library",
    name: "Library",
    variantId: "library",
  },
  {
    kind: "restaurant",
    name: "Restaurant",
    variantId: "restaurant",
  },
  {
    kind: "cafe",
    name: "Cafe",
    variantId: "cafe",
  },
  {
    kind: "arcade",
    name: "Arcade",
    variantId: "arcade",
  },
  {
    kind: "recreation-center",
    name: "Recreation Center",
    variantId: "recreation-center",
  },
];

const PALETTES = [
  { wall: "#e8d7bd", roof: "#719b81", trim: "#fff0da" },
  { wall: "#c8dcd0", roof: "#5d8c81", trim: "#edf6e7" },
  { wall: "#e7c7bd", roof: "#b77b70", trim: "#fff1e2" },
  { wall: "#cad7e5", roof: "#7c91b2", trim: "#f2f3ed" },
  { wall: "#d9cde2", roof: "#8e7ca7", trim: "#f7edf5" },
  { wall: "#eadcbd", roof: "#aa8c69", trim: "#fff4df" },
];

// --------------------------------------------------
// Position and randomness helpers
// --------------------------------------------------

function cellPoint(x: number, z: number) {
  return {
    x: ((x + 0.5) / GRID_SIZE - 0.5) * BOARD_SIZE,
    z: ((z + 0.5) / GRID_SIZE - 0.5) * BOARD_SIZE,
  };
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function random(seed: number, salt: number) {
  let n = (seed + salt * 374761393) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);

  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// --------------------------------------------------
// Reusable geometry
// --------------------------------------------------

function Block({
  position,
  size,
  color,
  rotation,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Window({
  position,
  size = [0.14, 0.14],
  rotation = 0,
}: {
  position: [number, number, number];
  size?: [number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Block
        position={[0, 0, 0]}
        size={[size[0] + 0.035, size[1] + 0.035, 0.025]}
        color="#f5ecdc"
      />

      <Block
        position={[0, 0, 0.017]}
        size={[size[0], size[1], 0.015]}
        color="#83b7bd"
      />

      <Block
        position={[0, 0, 0.03]}
        size={[0.012, size[1], 0.012]}
        color="#f7efdb"
      />
    </group>
  );
}

function TinyTree({
  position,
  seed,
  scale = 1,
}: {
  position: [number, number, number];
  seed: number;
  scale?: number;
}) {
  const height = (0.3 + random(seed, 1) * 0.2) * scale;
  const radius = (0.13 + random(seed, 2) * 0.07) * scale;

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry
          args={[0.02 * scale, 0.035 * scale, height, 7]}
        />
        <meshStandardMaterial color="#8b7055" />
      </mesh>

      <mesh
        position={[0, height + radius * 0.35, 0]}
        castShadow
      >
        <icosahedronGeometry args={[radius, 1]} />
        <meshStandardMaterial
          color={random(seed, 3) > 0.5 ? "#72aa75" : "#50956c"}
          roughness={1}
          flatShading
        />
      </mesh>
    </group>
  );
}

// --------------------------------------------------
// Buildings
// --------------------------------------------------

function BuildingMesh({ item }: { item: Building }) {
  const seed = hashString(item.id);

  const kind: BuildingKind =
    item.kind ??
    (item.variantId === "solar-workshop" ? "workshop" : "house");

  const level = Math.max(1, Math.min(5, item.level ?? 1));
  const nature = Math.max(0, Math.min(1, item.natureGrowth ?? 0));

  const center = cellPoint(
    item.gridPosition.x + (item.footprint.width - 1) / 2,
    item.gridPosition.z + (item.footprint.depth - 1) / 2
  );

  const palette = PALETTES[seed % PALETTES.length];

  // Tiny randomized building dimensions.
  const width =
    (0.48 + random(seed, 4) * 0.22) *
    item.footprint.width;

  const depth =
    (0.45 + random(seed, 5) * 0.2) *
    item.footprint.depth;

  const height =
    (0.28 + (level - 1) * 0.085) *
    (0.85 + random(seed, 6) * 0.3);

  const base = 0.035;
  const top = base + height;
  const front = depth / 2;

  const flatRoof = kind !== "house" && kind !== "cafe";

  const roofHeight = 0.1 + random(seed, 7) * 0.07;

  const floorCount = Math.min(level, 4);

  const accent: Record<BuildingKind, string> = {
    house: "#bd9271",
    workshop: "#568f85",
    school: "#d3a454",
    library: "#907da6",
    restaurant: "#c96f65",
    cafe: "#9d785b",
    arcade: "#ac78cb",
    "recreation-center": "#7ab39a",
  };

  const buildingAccent = accent[kind];

  return (
    <group
      position={[center.x, 0, center.z]}
      rotation={[0, item.rotation, 0]}
    >
      {/* Foundation */}
      <Block
        position={[0, base / 2, 0]}
        size={[width + 0.1, base, depth + 0.1]}
        color="#b5b9a4"
      />

      {/* Main structure */}
      <Block
        position={[0, base + height / 2, 0]}
        size={[width, height, depth]}
        color={palette.wall}
      />

      {/* Trim */}
      <Block
        position={[0, top - 0.025, 0]}
        size={[width + 0.025, 0.03, depth + 0.025]}
        color={palette.trim}
      />

      {/* Windows */}
      {Array.from({ length: floorCount }, (_, floor) => {
        const y =
          base +
          ((floor + 0.5) / floorCount) * height;

        const windowHeight = Math.min(
          0.11,
          (height / floorCount) * 0.5
        );

        return (
          <group key={`floor-${floor}`}>
            {[-1, 1].map((side) => (
              <group key={side}>
                <Window
                  position={[
                    side * width * 0.26,
                    y,
                    front + 0.015,
                  ]}
                  size={[0.105, windowHeight]}
                />

                <Window
                  position={[
                    side * width * 0.26,
                    y,
                    -front - 0.015,
                  ]}
                  rotation={Math.PI}
                  size={[0.105, windowHeight]}
                />
              </group>
            ))}
          </group>
        );
      })}

      {/* Door */}
      <Block
        position={[0, base + 0.1, front + 0.02]}
        size={[0.13, 0.2, 0.035]}
        color={buildingAccent}
      />

      {/* Roof */}
      {flatRoof ? (
        <Block
          position={[0, top + 0.025, 0]}
          size={[width + 0.085, 0.05, depth + 0.085]}
          color={palette.roof}
        />
      ) : (
        <mesh
          position={[0, top + roofHeight / 2, 0]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
        >
          <coneGeometry
            args={[
              Math.max(width, depth) * 0.76,
              roofHeight,
              4,
            ]}
          />
          <meshStandardMaterial
            color={palette.roof}
            roughness={0.9}
            flatShading
          />
        </mesh>
      )}

      {/* Workshop solar panels */}
      {kind === "workshop" &&
        [-1, 1].map((side) => (
          <Block
            key={side}
            position={[
              side * width * 0.23,
              top + 0.06,
              0,
            ]}
            size={[width * 0.3, 0.018, depth * 0.45]}
            color="#3d687d"
          />
        ))}

      {/* School clock */}
      {kind === "school" && (
        <mesh position={[0, top - 0.1, front + 0.03]}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 16]} />
          <meshStandardMaterial color="#fff3d5" />
        </mesh>
      )}

      {/* Library columns */}
      {kind === "library" &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            position={[
              side * width * 0.34,
              base + 0.11,
              front + 0.06,
            ]}
            castShadow
          >
            <cylinderGeometry args={[0.025, 0.03, 0.22, 8]} />
            <meshStandardMaterial color="#f5ebdb" />
          </mesh>
        ))}

      {/* Restaurant/cafe awning */}
      {(kind === "restaurant" || kind === "cafe") && (
        <Block
          position={[0, base + 0.24, front + 0.09]}
          size={[width * 0.75, 0.035, 0.18]}
          color={buildingAccent}
        />
      )}

      {/* Arcade neon */}
      {kind === "arcade" && (
        <Block
          position={[0, top - 0.09, front + 0.035]}
          size={[width * 0.7, 0.055, 0.03]}
          color="#cf95ef"
        />
      )}

      {/* Recreation center skylight */}
      {kind === "recreation-center" && (
        <Block
          position={[0, top + 0.055, 0]}
          size={[width * 0.4, 0.015, depth * 0.35]}
          color="#a4d6d3"
        />
      )}

      {/* Moss */}
      {Array.from(
        { length: Math.floor(nature * 8) },
        (_, index) => {
          const x =
            (random(seed, index + 20) - 0.5) *
            width *
            0.8;

          const y =
            base +
            random(seed, index + 40) *
              height *
              0.7;

          const side = index % 2 === 0 ? 1 : -1;

          return (
            <Block
              key={`moss-${index}`}
              position={[x, y, side * (front + 0.015)]}
              size={[0.05, 0.045, 0.015]}
              color={
                index % 2 === 0
                  ? "#609c63"
                  : "#83ae69"
              }
            />
          );
        }
      )}

      {/* Vines */}
      {Array.from(
        { length: Math.floor(nature * 4) },
        (_, index) => {
          const x =
            (random(seed, index + 60) - 0.5) *
            width *
            0.7;

          const vineHeight =
            height *
            (0.25 + random(seed, index + 70) * 0.45);

          return (
            <Block
              key={`vine-${index}`}
              position={[
                x,
                top - vineHeight / 2,
                front + 0.02,
              ]}
              size={[0.02, vineHeight, 0.02]}
              color="#4d9258"
            />
          );
        }
      )}

      {/* Rooftop greenery */}
      {flatRoof &&
        Array.from(
          { length: Math.floor(nature * 3) },
          (_, index) => (
            <mesh
              key={`roof-plant-${index}`}
              position={[
                (index - 1) * width * 0.22,
                top + 0.09,
                -depth * 0.2,
              ]}
              castShadow
            >
              <icosahedronGeometry args={[0.06, 1]} />
              <meshStandardMaterial
                color="#70aa72"
                flatShading
              />
            </mesh>
          )
        )}

      {/* Tiny trees */}
      {nature >= 0.5 && (
        <TinyTree
          position={[
            width / 2 + 0.12,
            0,
            -depth / 2 - 0.08,
          ]}
          seed={seed}
          scale={0.4}
        />
      )}

      {nature >= 0.9 && (
        <TinyTree
          position={[
            -width / 2 - 0.12,
            0,
            depth / 2 + 0.08,
          ]}
          seed={seed + 13}
          scale={0.35}
        />
      )}
    </group>
  );
}

// --------------------------------------------------
// Plants
// --------------------------------------------------

function PlantMesh({ item }: { item: Plant }) {
  const center = cellPoint(
    item.gridPosition.x,
    item.gridPosition.z
  );

  const seed = hashString(item.id);
  const growth = Math.max(0.1, item.growth);

  if (item.species === "fern") {
    return (
      <group position={[center.x, 0, center.z]}>
        {Array.from({ length: 5 }, (_, index) => {
          const angle = (index / 5) * Math.PI * 2;

          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * 0.06,
                0.09 * growth,
                Math.sin(angle) * 0.06,
              ]}
              rotation={[0, angle, 0.6]}
              castShadow
            >
              <coneGeometry
                args={[0.065, 0.22 * growth, 5]}
              />
              <meshStandardMaterial
                color="#5e9b70"
                flatShading
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      </group>
    );
  }

  return (
    <TinyTree
      position={[center.x, 0, center.z]}
      seed={seed}
      scale={0.45 + growth * 0.3}
    />
  );
}

// --------------------------------------------------
// Residents
// --------------------------------------------------

function ResidentMesh({ item }: { item: Resident }) {
  const seed = hashString(item.id);

  const color = [
    "#e5b58e",
    "#8ab7b0",
    "#b4a0ce",
    "#d4b16d",
  ][seed % 4];

  return (
    <group
      position={[
        item.position.x,
        0,
        item.position.z,
      ]}
    >
      <mesh position={[0, 0.09, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color="#e8c6a5" />
      </mesh>
    </group>
  );
}

// --------------------------------------------------
// Circular island
// --------------------------------------------------

function CircularTerrain({ night }: { night: boolean }) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.035, 0]}
        receiveShadow
      >
        <circleGeometry args={[ISLAND_RADIUS, 96]} />
        <meshStandardMaterial
          color={night ? "#315b56" : "#87b99a"}
          roughness={0.96}
        />
      </mesh>

      <mesh
        position={[0, -0.32, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[
            ISLAND_RADIUS,
            ISLAND_RADIUS - 0.24,
            0.56,
            96,
          ]}
        />
        <meshStandardMaterial
          color={night ? "#264d49" : "#678d73"}
          roughness={0.95}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.015, 0]}
      >
        <torusGeometry
          args={[ISLAND_RADIUS, 0.04, 8, 96]}
        />
        <meshStandardMaterial
          color="#c4e6d6"
          metalness={0.25}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

// --------------------------------------------------
// Glass dome
// --------------------------------------------------

function GlassDome() {
  const radius = ISLAND_RADIUS + 0.25;
  const height = 7;

  const geometry = useMemo(() => {
    const points: THREE.Vector2[] = [];

    for (let i = 0; i <= 64; i++) {
      const r = (i / 64) * radius;

      const y =
        height * (1 - (r * r) / (radius * radius));

      points.push(new THREE.Vector2(r, y));
    }

    return new THREE.LatheGeometry(points, 128);
  }, [radius]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color="#d7f6f0"
          transparent
          opacity={0.075}
          roughness={0.08}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
      >
        <torusGeometry
          args={[radius, 0.025, 8, 128]}
        />
        <meshStandardMaterial
          color="#d0f5eb"
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}

// --------------------------------------------------
// World scene
// --------------------------------------------------

function World() {
  const buildings = useWorldStore(selectBuildings);
  const plants = useWorldStore(selectPlants);
  const residents = useWorldStore(selectResidents);

  const [night, setNight] = useState(false);

  useEffect(() => {
    const updateLighting = () => {
      const hour = new Date().getHours();
      setNight(hour < 6 || hour >= 19);
    };

    updateLighting();

    const timer = window.setInterval(
      updateLighting,
      60_000
    );

    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <color
        attach="background"
        args={[night ? "#102a35" : "#b7deda"]}
      />

      <ambientLight
        intensity={night ? 0.8 : 1.5}
        color={night ? "#9bbbdc" : "#fff4df"}
      />

      <directionalLight
        position={[-5, 9, 6]}
        intensity={night ? 1.1 : 2.4}
        color={night ? "#b2d0ff" : "#fff2d4"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      <CircularTerrain night={night} />

      {buildings.map((building) => (
        <BuildingMesh
          key={building.id}
          item={building}
        />
      ))}

      {plants.map((plant) => (
        <PlantMesh key={plant.id} item={plant} />
      ))}

      {residents.map((resident) => (
        <ResidentMesh
          key={resident.id}
          item={resident}
        />
      ))}

      <GlassDome />

      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.12}
        target={[0, 0.5, 0]}
      />
    </>
  );
}

// --------------------------------------------------
// App
// --------------------------------------------------

function App() {
  const advanceTime = useWorldStore(
    (state) => state.advanceTime
  );

  const recordInput = useWorldStore(
    (state) => state.recordInput
  );

  const setActivityCategory = useWorldStore(
    (state) => state.setActivityCategory
  );

  const setSystemIdle = useWorldStore(
    (state) => state.setSystemIdle
  );

  const activity = useWorldStore(selectActivity);
  const buildings = useWorldStore(selectBuildings);

  const addBuilding = useWorldStore(
    (state) => state.addBuilding
  );

  const resetWorld = useWorldStore(
    (state) => state.resetWorld
  );

  // Electron idle monitoring.
  useEffect(() => {
    const api = window.edenAPI;

    if (!api) return;

    let mounted = true;
    let latestTimestamp = -Infinity;

    const handleActivity = (result: {
      status: "active" | "idle";
      timestamp: number;
    }) => {
      if (
        !mounted ||
        result.timestamp < latestTimestamp
      ) {
        return;
      }

      latestTimestamp = result.timestamp;

      setSystemIdle(result.status === "idle");
    };

    const unsubscribe =
      api.onActivityChanged(handleActivity);

    api.getCurrentActivity()
      .then((result) => {
        if (result) handleActivity(result);
      })
      .catch(console.error);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setSystemIdle]);

  // Simulation timer.
  useEffect(() => {
    let previous = Date.now();

    const timer = window.setInterval(() => {
      const now = Date.now();

      advanceTime(
        (now - previous) / 1000,
        now
      );

      previous = now;
    }, 1000);

    const onInput = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        event.altKey &&
        (event.key === "1" || event.key === "2")
      ) {
        event.preventDefault();

        setActivityCategory(
          event.key === "1"
            ? "productivity"
            : "leisure"
        );

        return;
      }

      if (!window.edenAPI) {
        recordInput();
      }
    };

    window.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
    window.addEventListener("wheel", onInput);

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "pointerdown",
        onInput
      );

      window.removeEventListener(
        "keydown",
        onInput
      );

      window.removeEventListener(
        "wheel",
        onInput
      );
    };
  }, [
    advanceTime,
    recordInput,
    setActivityCategory,
  ]);

  // Random test building.
  function handleAddBuilding() {
    const available: { x: number; z: number }[] = [];

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const overlaps = buildings.some((building) => {
          const bx = building.gridPosition.x;
          const bz = building.gridPosition.z;

          return (
            x < bx + building.footprint.width &&
            x + 1 > bx &&
            z < bz + building.footprint.depth &&
            z + 1 > bz
          );
        });

        if (!overlaps) {
          available.push({ x, z });
        }
      }
    }

    if (available.length === 0) {
      window.alert(
        "The island is full! All 36 grid cells are occupied."
      );
      return;
    }

    const position =
      available[
        Math.floor(Math.random() * available.length)
      ];

    const definition =
      BUILDING_TYPES[
        Math.floor(
          Math.random() * BUILDING_TYPES.length
        )
      ];

    const rotation =
      Math.floor(Math.random() * 4) *
      (Math.PI / 2);

    addBuilding({
      type: "building",
      id: crypto.randomUUID(),

      name: definition.name,
      variantId: definition.variantId,
      kind: definition.kind,

      level: 1,
      natureGrowth: 0,

      gridPosition: position,

      footprint: {
        width: 1,
        depth: 1,
      },

      rotation,
      createdAt: Date.now(),
    });
  }

  function handleResetWorld() {
    if (
      window.confirm(
        "Reset the world and start a new city?"
      )
    ) {
      resetWorld();
    }
  }

  return (
    <main
      className="app"
      style={{ position: "relative" }}
    >
      <Canvas
        shadows
        camera={{
          position: [15, 13, 18],
          fov: 45,
        }}
        dpr={[1, 1.5]}
      >
        <World />
      </Canvas>

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 12,
          borderRadius: 10,
          background: "rgba(12, 40, 45, 0.85)",
          color: "white",
          fontSize: 13,
        }}
      >
        <strong>
          Buildings: {buildings.length} / 36
        </strong>

        <span>
          Productivity:{" "}
          {Math.floor(activity.productivityPoints)}s
        </span>

        <span>
          Leisure:{" "}
          {Math.floor(activity.leisurePoints)}s
        </span>

        <span>
          Mode: {activity.category}
        </span>

        <button
          type="button"
          onClick={handleAddBuilding}
        >
          Add Random Building
        </button>

        <button
          type="button"
          onClick={handleResetWorld}
        >
          Reset World
        </button>
      </div>

      <div className="wordmark">
        EDEN<span>.EXE</span>
      </div>

      <div className="status">
        <i className={activity.category} />
        {activity.category}
      </div>
    </main>
  );
}

export default App;
