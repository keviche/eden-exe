
import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  selectActivity,
  selectBuildings,
  selectPlants,
  selectResidents,
  useWorldStore,
} from "./state/worldStore";
import type { Building, Plant, Resident } from "./simulation/types";
import "./App.css";

const BOARD_SIZE = 9;
const GRID_SIZE = 6;
const BUILDING_SIZE = 2;

function cellPoint(x: number, z: number, width: number, depth: number) {
  return { x: ((x + 0.5) / width - 0.5) * BOARD_SIZE, z: ((z + 0.5) / depth - 0.5) * BOARD_SIZE };
}

type EdenVector = [number, number, number];

function EdenBlock({
  size,
  position = [0, 0, 0],
  color,
  roughness = 0.75,
  metalness = 0,
}: {
  size: EdenVector;
  position?: EdenVector;
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}

function EdenWindow({
  position,
  rotation = 0,
  width = 0.28,
  height = 0.32,
}: {
  position: EdenVector;
  rotation?: number;
  width?: number;
  height?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Dark surround gives the window a recessed appearance. */}
      <EdenBlock
        size={[width + 0.065, height + 0.065, 0.04]}
        color="#285c57"
      />

      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[width, height, 0.012]} />
        <meshStandardMaterial
          color="#c4eee4"
          roughness={0.18}
          metalness={0.12}
          emissive="#ffd89a"
          emissiveIntensity={0.28}
        />
      </mesh>

      {/* Center mullion and projecting sill. */}
      <EdenBlock
        size={[0.018, height, 0.018]}
        position={[0, 0, 0.038]}
        color="#f2ecd9"
      />
      <EdenBlock
        size={[width + 0.10, 0.035, 0.095]}
        position={[0, -height / 2 - 0.03, 0.015]}
        color="#f2ecd9"
      />
    </group>
  );
}

function EdenPlanter({
  position,
  size = 0.16,
}: {
  position: EdenVector;
  size?: number;
}) {
  return (
    <group position={position}>
      <EdenBlock
        size={[size, size * 0.65, size]}
        position={[0, size * 0.325, 0]}
        color="#c58d68"
      />
      <EdenBlock
        size={[size * 1.12, size * 0.14, size * 1.12]}
        position={[0, size * 0.65, 0]}
        color="#dfb18b"
      />

      {/* Overlapping crowns make a fuller little shrub. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            side * size * 0.23,
            size * 1.02,
            side * size * 0.12,
          ]}
          scale={[1, 0.9, 1]}
          castShadow
        >
          <icosahedronGeometry args={[size * 0.65, 1]} />
          <meshStandardMaterial
            color={side === -1 ? "#4f9d68" : "#82bf76"}
            roughness={0.95}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function EdenSolarPanel({
  position,
  tilt,
  width,
  depth,
}: {
  position: EdenVector;
  tilt: number;
  width: number;
  depth: number;
}) {
  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      <EdenBlock
        size={[width, 0.035, depth]}
        color="#d9e8df"
        roughness={0.4}
        metalness={0.25}
      />
      <EdenBlock
        size={[width - 0.035, 0.01, depth - 0.035]}
        position={[0, 0.024, 0]}
        color="#22516b"
        roughness={0.24}
        metalness={0.35}
      />

      {/* Cell divisions. */}
      <EdenBlock
        size={[0.008, 0.006, depth - 0.035]}
        position={[0, 0.032, 0]}
        color="#83b9c5"
      />
      <EdenBlock
        size={[width - 0.035, 0.006, 0.008]}
        position={[0, 0.032, 0]}
        color="#83b9c5"
      />
    </group>
  );
}

function BuildingMesh({ item }: { item: Building }) {
  const at = cellPoint(
    item.gridPosition.x + (item.footprint.width - 1) / 2,
    item.gridPosition.z + (item.footprint.depth - 1) / 2,
    GRID_SIZE,
    GRID_SIZE
  );

  const workshop = item.variantId === "solar-workshop";
  const cellSize = BOARD_SIZE / 6;

  // Leave space around each building for steps and roof overhangs.
  const width = item.footprint.width * cellSize - 0.32;
  const depth = item.footprint.depth * cellSize - 0.5;

  // Stable variation: buildings keep their appearance across renders.
  const seed = Array.from(String(item.id)).reduce(
    (sum, letter) => sum + letter.charCodeAt(0),
    0,
  );

  const height = workshop
    ? 1.65 + (seed % 3) * 0.1
    : 1.0 + (seed % 3) * 0.05;

  const houseColors = ["#e9dfc7", "#e6cdb7", "#d8e1cf"];
  const workshopColors = ["#aad6c4", "#a7cfd1", "#bdd8b4"];
  const wallColor = (workshop ? workshopColors : houseColors)[seed % 3];

  const base = 0.12;
  const wallTop = base + height;
  const front = depth / 2;
  const doorWidth = Math.min(0.3, width * 0.23);
  const windowWidth = Math.min(0.42, width * 0.23);
  const windowHeight = workshop ? 0.32 : 0.28;

  const windowRows = workshop
    ? [base + height * 0.32, base + height * 0.76]
    : [base + height * 0.74];

  const roofHeight = 0.48;
  const roofDepth = depth + 0.16;
  const roofTilt = Math.atan2(roofHeight, roofDepth / 2);
  const housePanelDepth = Math.hypot(roofHeight, roofDepth / 2) * 0.52;
  const workshopPanelDepth = depth * 0.45;

  return (
    <group position={[at.x, 0, at.z]} rotation={[0, item.rotation, 0]}>
      {/* Stone foundation and main walls. */}
      <EdenBlock
        size={[width + 0.1, base, depth + 0.1]}
        position={[0, base / 2, 0]}
        color="#acb6a4"
      />
      <EdenBlock
        size={[width, height, depth]}
        position={[0, base + height / 2, 0]}
        color={wallColor}
      />

      {/* Cream corner trim breaks up the plain box silhouette. */}
      {[-1, 1].flatMap((xSide) =>
        [-1, 1].map((zSide) => (
          <EdenBlock
            key={`corner-${xSide}-${zSide}`}
            size={[0.045, height, 0.045]}
            position={[
              xSide * width / 2,
              base + height / 2,
              zSide * depth / 2,
            ]}
            color="#f1ecdc"
          />
        )),
      )}

      {/* Windows on the front, back, and both sides. */}
      {windowRows.map((y, row) => (
        <group key={`floor-${row}`}>
          {[-1, 1].map((side) => (
            <group key={`windows-${side}`}>
              <EdenWindow
                position={[side * width * 0.32, y, front + 0.012]}
                width={windowWidth}
                height={windowHeight}
              />
              <EdenWindow
                position={[side * width * 0.32, y, -front - 0.012]}
                rotation={Math.PI}
                width={windowWidth}
                height={windowHeight}
              />
              <EdenWindow
                position={[side * (width / 2 + 0.012), y, 0]}
                rotation={side * Math.PI / 2}
                width={Math.min(0.42, depth * 0.3)}
                height={windowHeight}
              />
            </group>
          ))}
        </group>
      ))}

      {workshop && (
        <EdenBlock
          size={[width + 0.025, 0.045, depth + 0.025]}
          position={[0, base + height * 0.53, 0]}
          color="#ecedda"
        />
      )}

      {/* Entrance: frame, door glass, brass handle, and canopy. */}
      <EdenBlock
        size={[doorWidth + 0.065, 0.6, 0.05]}
        position={[0, base + 0.3, front + 0.025]}
        color="#345e54"
      />
      <EdenBlock
        size={[doorWidth, 0.54, 0.022]}
        position={[0, base + 0.27, front + 0.055]}
        color={workshop ? "#568f83" : "#b88a65"}
      />

      <mesh position={[0, base + 0.36, front + 0.073]}>
        <boxGeometry args={[doorWidth * 0.7, 0.23, 0.012]} />
        <meshStandardMaterial
          color="#c5eee0"
          roughness={0.2}
          emissive="#ffdcaa"
          emissiveIntensity={0.2}
        />
      </mesh>

      <mesh
        position={[doorWidth * 0.3, base + 0.24, front + 0.086]}
      >
        <sphereGeometry args={[0.015, 8, 6]} />
        <meshStandardMaterial
          color="#e6bf71"
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>

      <EdenBlock
        size={[doorWidth + 0.14, 0.055, 0.28]}
        position={[0, base + 0.66, front + 0.08]}
        color={workshop ? "#377f71" : "#cbad82"}
      />
      <EdenBlock
        size={[doorWidth + 0.18, base, 0.22]}
        position={[0, base / 2, front + 0.09]}
        color="#d5d4bc"
      />

      {[-1, 1].map((side) => (
        <EdenPlanter
          key={`entrance-plant-${side}`}
          position={[side * width * 0.4, 0, front + 0.1]}
          size={0.15}
        />
      ))}

      {workshop ? (
        <group>
          {/* Flat roof with a planted surface and raised edges. */}
          <EdenBlock
            size={[width + 0.16, 0.075, depth + 0.16]}
            position={[0, wallTop + 0.025, 0]}
            color="#edf0df"
          />
          <EdenBlock
            size={[width, 0.045, depth]}
            position={[0, wallTop + 0.075, 0]}
            color="#80ab73"
          />

          {[-1, 1].map((side) => (
            <group key={`roof-edge-${side}`}>
              <EdenBlock
                size={[width + 0.12, 0.1, 0.06]}
                position={[0, wallTop + 0.105, side * (depth / 2 + 0.025)]}
                color="#dce6ce"
              />
              <EdenBlock
                size={[0.06, 0.1, depth + 0.1]}
                position={[side * (width / 2 + 0.025), wallTop + 0.105, 0]}
                color="#dce6ce"
              />

              <EdenSolarPanel
                position={[
                  side * width * 0.24,
                  wallTop + 0.18 + workshopPanelDepth * Math.sin(0.22) / 2,
                  depth * 0.1,
                ]}
                tilt={0.22}
                width={width * 0.34}
                depth={workshopPanelDepth}
              />

              <EdenPlanter
                position={[side * width * 0.28, wallTop + 0.1, -depth * 0.32]}
                size={0.2}
              />
            </group>
          ))}
        </group>
      ) : (
        <group>
          {/* A four-sided roof scaled to the building's actual footprint. */}
          <EdenBlock
            size={[width + 0.13, 0.065, depth + 0.13]}
            position={[0, wallTop, 0]}
            color="#eee7d2"
          />

          <mesh
            position={[0, wallTop + roofHeight / 2, 0]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[width + 0.16, 1, roofDepth]}
            castShadow
            receiveShadow
          >
            <coneGeometry args={[Math.SQRT1_2, roofHeight, 4]} />
            <meshStandardMaterial
              color={seed % 2 === 0 ? "#438e76" : "#537f72"}
              roughness={0.9}
              flatShading
            />
          </mesh>

          {[-1, 1].map((side) => (
            <EdenSolarPanel
              key={`house-panel-${side}`}
              position={[
                side * width * 0.22,
                wallTop + roofHeight * 0.48 + 0.035 * Math.cos(roofTilt),
                roofDepth * 0.26 + 0.035 * Math.sin(roofTilt),
              ]}
              tilt={roofTilt}
              width={width * 0.33}
              depth={housePanelDepth}
            />
          ))}

          {/* Small capped chimney toward the rear. */}
          <EdenBlock
            size={[0.14, 0.42, 0.14]}
            position={[
              -width * 0.32,
              wallTop + roofHeight * 0.46 + 0.17,
              -depth * 0.25,
            ]}
            color="#d4c8ad"
          />
          <EdenBlock
            size={[0.19, 0.045, 0.19]}
            position={[
              -width * 0.32,
              wallTop + roofHeight * 0.46 + 0.4,
              -depth * 0.25,
            ]}
            color="#52796b"
          />
        </group>
      )}
    </group>
  );
}

type EdenPlantVector = [number, number, number];

// A stem or branch connecting two points.
function EdenPlantStem({
  start,
  end,
  radius = 0.012,
  color = "#54804d",
}: {
  start: EdenPlantVector;
  end: EdenPlantVector;
  radius?: number;
  color?: string;
}) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];

  const length = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dx, dz);
  const tilt = Math.atan2(Math.hypot(dx, dz), dy);

  return (
    <group
      position={[
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
        (start[2] + end[2]) / 2,
      ]}
      rotation={[0, yaw, 0]}
    >
      <mesh rotation={[tilt, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.7, radius, length, 6]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
    </group>
  );
}

// An elongated, flattened leaf.
function EdenLeaf({
  position,
  rotation = [0, 0, 0],
  length = 0.2,
  width = 0.07,
  color = "#66aa68",
}: {
  position: EdenPlantVector;
  rotation?: EdenPlantVector;
  length?: number;
  width?: number;
  color?: string;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={[width / 2, length / 2, 0.012]}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </mesh>
  );
}

// A rounded, faceted foliage cluster.
function EdenFoliage({
  position,
  radius,
  color,
  scale = [1, 0.9, 1],
}: {
  position: EdenPlantVector;
  radius: number;
  color: string;
  scale?: EdenPlantVector;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <icosahedronGeometry args={[radius, 1]} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </mesh>
  );
}

function EdenFern() {
  // These points trace a frond that bends outward as it rises.
  const points: EdenPlantVector[] = [
    [0, 0, 0],
    [0, 0.18, 0.08],
    [0, 0.31, 0.2],
    [0, 0.39, 0.34],
  ];

  return (
    <group>
      {Array.from({ length: 5 }, (_, frond) => (
        <group
          key={frond}
          rotation={[0, (frond / 5) * Math.PI * 2, 0]}
          scale={0.85 + (frond % 3) * 0.08}
        >
          {points.slice(1).map((point, segment) => (
            <EdenPlantStem
              key={`stem-${segment}`}
              start={points[segment]!}
              end={point}
              radius={0.009}
            />
          ))}

          {points.slice(1).map(([x, y, z], row) =>
            [-1, 1].map((side) => (
              <EdenLeaf
                key={`leaf-${row}-${side}`}
                position={[x + side * 0.06, y + 0.04, z + 0.015]}
                rotation={[0.35, 0, -side]}
                length={0.18 - row * 0.035}
                width={0.065 - row * 0.01}
                color={(frond + row) % 2 === 0 ? "#75bb78" : "#409566"}
              />
            )),
          )}

          <EdenLeaf
            position={[0, 0.42, 0.39]}
            rotation={[1, 0, 0]}
            length={0.16}
            width={0.055}
            color="#8acb86"
          />
        </group>
      ))}
    </group>
  );
}

function EdenFlowers({ seed }: { seed: number }) {
  const petalColors = ["#eaa6b2", "#f0d28d", "#c0afe5", "#f3e9cf"];
  const petalColor = petalColors[seed % petalColors.length];

  const stalks = [
    { x: -0.16, z: 0.02, height: 0.61 },
    { x: 0.15, z: 0.07, height: 0.47 },
    { x: 0.02, z: -0.14, height: 0.76 },
  ];

  return (
    <group>
      {stalks.map(({ x, z, height }, index) => (
        <group
          key={index}
          position={[x, 0, z]}
          rotation={[0, index * 1.7, 0]}
        >
          <EdenPlantStem
            start={[0, 0, 0]}
            end={[0, height, 0]}
            radius={0.014}
          />

          {[-1, 1].map((side) => (
            <EdenLeaf
              key={side}
              position={[
                side * 0.08,
                height * (side === -1 ? 0.3 : 0.55) + 0.08,
                0,
              ]}
              rotation={[0, 0, -side * 0.75]}
              length={0.24}
              width={0.095}
              color={side === -1 ? "#599e65" : "#83ba75"}
            />
          ))}

          {/* Flower head faces upward, with a slight natural tilt. */}
          <group
            position={[0, height, 0]}
            rotation={[0.14, index * 0.8, 0.08]}
            scale={0.8 + (index % 2) * 0.15}
          >
            {Array.from({ length: 6 }, (_, petal) => (
              <group
                key={petal}
                rotation={[0, (petal / 6) * Math.PI * 2, 0]}
              >
                <mesh position={[0, 0, 0.105]} scale={[0.065, 0.025, 0.105]} castShadow>
                  <sphereGeometry args={[1, 8, 5]} />
                  <meshStandardMaterial
                    color={petalColor}
                    roughness={0.8}
                  />
                </mesh>
              </group>
            ))}

            <mesh position={[0, 0.025, 0]} scale={[1, 0.5, 1]} castShadow>
              <sphereGeometry args={[0.065, 8, 6]} />
              <meshStandardMaterial color="#d5a24e" roughness={0.95} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function EdenShrub({ seed }: { seed: number }) {
  const clusters = [
    [-0.2, 0.26, 0.02, 0.22],
    [0.2, 0.27, 0.05, 0.23],
    [0, 0.28, -0.18, 0.24],
    [0, 0.42, 0.01, 0.27],
  ];

  return (
    <group>
      <EdenPlantStem
        start={[0, 0, 0]}
        end={[0, 0.27, 0]}
        radius={0.035}
        color="#817152"
      />

      {clusters.map(([x, y, z, radius], index) => (
        <EdenFoliage
          key={index}
          position={[x, y, z]}
          radius={radius}
          color={index % 2 === 0 ? "#478d61" : "#71aa69"}
        />
      ))}

      {/* Some shrubs have small berries. */}
      {seed % 3 === 0 &&
        Array.from({ length: 5 }, (_, berry) => {
          const angle = berry * 2.4;

          return (
            <mesh
              key={berry}
              position={[
                Math.cos(angle) * 0.22,
                0.46 + (berry % 2) * 0.08,
                Math.sin(angle) * 0.22,
              ]}
              castShadow
            >
              <sphereGeometry args={[0.027, 6, 4]} />
              <meshStandardMaterial color="#df927d" roughness={0.8} />
            </mesh>
          );
        })}
    </group>
  );
}

function EdenTree({ seed }: { seed: number }) {
  const colors = ["#548e60", "#73a866", "#8bb774"];
  const crowns = [
    [0, 1.02, 0, 0.33],
    [-0.23, 0.89, 0.03, 0.27],
    [0.22, 0.92, 0.02, 0.28],
    [0, 0.95, -0.23, 0.26],
    [0.04, 1.23, -0.025, 0.25],
  ];

  return (
    <group>
      <EdenPlantStem
        start={[0, 0, 0]}
        end={[0, 0.98, 0]}
        radius={0.075}
        color="#977652"
      />

      {[-1, 1].map((side) => (
        <EdenPlantStem
          key={side}
          start={[0, 0.53, 0]}
          end={[side * 0.23, 0.89, 0.03]}
          radius={0.028}
          color="#977652"
        />
      ))}

      {crowns.map(([x, y, z, radius], index) => (
        <EdenFoliage
          key={index}
          position={[x, y, z]}
          radius={radius}
          color={colors[(seed + index) % colors.length]}
        />
      ))}
    </group>
  );
}

function EdenGrass({ seed }: { seed: number }) {
  return (
    <group>
      {Array.from({ length: 7 }, (_, blade) => {
        const length = 0.42 + (blade % 3) * 0.1;
        const tilt = 0.2 + (blade % 3) * 0.16;

        return (
          <group key={blade} rotation={[0, blade * 2.4, 0]}>
            <EdenLeaf
              position={[
                0,
                (length / 2) * Math.cos(tilt),
                (length / 2) * Math.sin(tilt),
              ]}
              rotation={[tilt, 0, 0]}
              length={length}
              width={0.055}
              color={(seed + blade) % 2 === 0 ? "#93bd76" : "#619c64"}
            />
          </group>
        );
      })}
    </group>
  );
}

function EdenPlantModel({
  species,
  seed,
}: {
  species: string;
  seed: number;
}) {
  switch (species) {
    case "fern":
      return <EdenFern />;
    case "flower":
      return <EdenFlowers seed={seed} />;
    case "tree":
      return <EdenTree seed={seed} />;
    case "grass":
      return <EdenGrass seed={seed} />;
    case "shrub":
    default:
      return <EdenShrub seed={seed} />;
  }
}

function PlantMesh({ item }: { item: Plant }) {
  const at = cellPoint(item.gridPosition.x, item.gridPosition.z, 6, 6);

  // A repeatable seed prevents plants changing appearance on rerenders.
  const seed = Array.from(String(item.id)).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

  // Assumes growth runs from 0 to 1.
  const growth = Math.max(0, Math.min(1, item.growth));
  const variation = 0.9 + (seed % 11) * 0.02;
  const size = (0.3 + growth * 0.7) * variation;
  const rotation = ((seed % 360) / 180) * Math.PI;

  return (
    <group
      position={[at.x, 0, at.z]}
      rotation={[0, rotation, 0]}
      scale={size}
    >
      <EdenPlantModel species={item.species} seed={seed} />
    </group>
  );
}

function ResidentMesh({ item }: { item: Resident }) {
  return (
    <mesh
      position={[
        (item.position.x / 2) * (BOARD_SIZE / GRID_SIZE),
        0.15,
        (item.position.z / 2) * (BOARD_SIZE / GRID_SIZE),
      ]}
    >
      <capsuleGeometry args={[0.09, 0.18, 3, 6]} />
      <meshStandardMaterial color="#e9b66e" />
    </mesh>
  );
}

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
      <color attach="background" args={[night ? "#102b36" : "#a9d9d5"]} />
      <fog attach="fog" args={[night ? "#102b36" : "#a9d9d5", 5, 30]} />
      <ambientLight intensity={night ? 0.55 : 1.15} color={night ? "#83b5dc" : "#fff2cf"} />
      <directionalLight
        position={[-4, 7, 5]}
        intensity={night ? 0.65 : 2.2}
        color={night ? "#9bc7ff" : "#fff4d1"}
        castShadow
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[BOARD_SIZE, BOARD_SIZE]}
        />
        <meshStandardMaterial
          color={night ? "#24545a" : "#72b6a0"}
          roughness={0.92}
        />
      </mesh>

      <gridHelper
        args={[
          BOARD_SIZE,
          GRID_SIZE,
          night ? "#5e9c96" : "#b4e2cc",
          night ? "#376c6d" : "#8bc8ae",
        ]}
        position={[0, -0.025, 0]}
      />

      {buildings.map((item) => (
        <BuildingMesh
          key={item.id}
          item={item}
        />
      ))}

      {plants.map((item) => (
        <PlantMesh
          key={item.id}
          item={item}
        />
      ))}

      {residents.map((item) => (
        <ResidentMesh
          key={item.id}
          item={item}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.15}
      />
    </>
  );
}

function App() {
  // Simulation state
  const advanceTime = useWorldStore(
    (state) => state.advanceTime
  );

  const recordInput = useWorldStore(
    (state) => state.recordInput
  );

  const setActivityCategory = useWorldStore(
    (state) => state.setActivityCategory
  );

  const activity = useWorldStore(selectActivity);

  // Building state
  const buildings = useWorldStore(selectBuildings);

  const addBuilding = useWorldStore(
    (state) => state.addBuilding
  );

  const resetWorld = useWorldStore(
    (state) => state.resetWorld
  );

  // Simulation timer and activity tracking
  useEffect(() => {
    let previous = Date.now();

    const timer = window.setInterval(() => {
      const now = Date.now();

      advanceTime((now - previous) / 1000, now);

      previous = now;
    }, 1000);

    const onInput = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        event.altKey &&
        ["1", "2", "3"].includes(event.key)
      ) {
        event.preventDefault();

        setActivityCategory(
          event.key === "1"
            ? "productivity"
            : event.key === "2"
              ? "leisure"
              : "idle"
        );

        return;
      }

      recordInput();
    };

    window.addEventListener("pointerdown", onInput);
    window.addEventListener("keydown", onInput);
    window.addEventListener("wheel", onInput);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("wheel", onInput);
    };
  }, [advanceTime, recordInput, setActivityCategory]);

  // Find the first available 2x2 space
  function handleAddBuilding() {
    for (
      let z = 0;
      z < GRID_SIZE;
      z += BUILDING_SIZE
    ) {
      for (
        let x = 0;
        x < GRID_SIZE;
        x += BUILDING_SIZE
      ) {
        const occupied = buildings.some(
          (building) =>
            x <
              building.gridPosition.x +
                building.footprint.width &&
            x + BUILDING_SIZE >
              building.gridPosition.x &&
            z <
              building.gridPosition.z +
                building.footprint.depth &&
            z + BUILDING_SIZE >
              building.gridPosition.z
        );

        if (!occupied) {
          addBuilding({
            type: "building",
            id: crypto.randomUUID(),
            variantId: "solar-house",
            name: "Solar House",
            gridPosition: { x, z },
            footprint: {
              width: BUILDING_SIZE,
              depth: BUILDING_SIZE,
            },
            rotation: 0,
            createdAt: Date.now(),
          });

          return;
        }
      }
    }

    alert("The 6x6 grid is full!");
  }

  function handleResetWorld() {
    if (window.confirm("Reset the entire world?")) {
      resetWorld();
    }
  }

  return (
    <main
      className="app"
      style={{ position: "relative" }}
    >
      {/* 3D environment */}
      <Canvas
        shadows
        camera={{
          position: [8, 8, 10],
          fov: 34,
        }}
        dpr={[1, 1.5]}
      >
        <World />
      </Canvas>

      {/* Building controls */}
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
          Buildings: {buildings.length}
        </strong>

        <button
          type="button"
          onClick={handleAddBuilding}
        >
          Add Test Building
        </button>

        <button
          type="button"
          onClick={handleResetWorld}
        >
          Reset World
        </button>
      </div>

      {/* EDEN.EXE branding */}
      <div className="wordmark">
        EDEN<span>.EXE</span>
      </div>

      {/* Activity status */}
      <div className="status">
        <i className={activity.category} />
        {activity.category}
      </div>
    </main>
  );
}

export default App;
