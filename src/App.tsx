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

function cellPoint(x: number, z: number, width: number, depth: number) {
  return { x: ((x + 0.5) / width - 0.5) * BOARD_SIZE, z: ((z + 0.5) / depth - 0.5) * BOARD_SIZE };
}

function BuildingMesh({ item }: { item: Building }) {
  const at = cellPoint(
    item.gridPosition.x + (item.footprint.width - 1) / 2,
    item.gridPosition.z + (item.footprint.depth - 1) / 2,
    6,
    6,
  );
  const height = item.variantId === "solar-workshop" ? 1.35 : 0.9;
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, item.rotation, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[1.2, height, 1.2]} />
        <meshStandardMaterial
          color={item.variantId === "solar-workshop" ? "#9dd9c8" : "#e0d4b5"}
          roughness={0.75}
        />
      </mesh>
      <mesh position={[0, height + 0.12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.83, 0.4, 4]} />
        <meshStandardMaterial color="#39a78b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.33, 0.61]}>
        <boxGeometry args={[0.25, 0.28, 0.025]} />
        <meshStandardMaterial color="#d8fff0" emissive="#69dcb7" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function PlantMesh({ item }: { item: Plant }) {
  const at = cellPoint(item.gridPosition.x, item.gridPosition.z, 6, 6);
  const size = 0.2 + item.growth * 0.35;
  return (
    <group position={[at.x, 0, at.z]}>
      <mesh position={[0, size / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.04, size, 5]} />
        <meshStandardMaterial color="#4f8e58" />
      </mesh>
      {[0, 1, 2].map((n) => (
        <mesh
          key={n}
          position={[
            Math.cos(n * 2.1) * 0.11,
            size * (0.65 + (n % 2) * 0.15),
            Math.sin(n * 2.1) * 0.11,
          ]}
          rotation={[0, n * 2.1, 0.6]}
        >
          <sphereGeometry args={[size * 0.32, 7, 5]} />
          <meshStandardMaterial color={item.species === "fern" ? "#62b77b" : "#39936c"} />
        </mesh>
      ))}
    </group>
  );
}

function ResidentMesh({ item }: { item: Resident }) {
  return (
    <mesh
      position={[
        (item.position.x / 2) * (BOARD_SIZE / 6),
        0.15,
        (item.position.z / 2) * (BOARD_SIZE / 6),
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
    const timer = window.setInterval(updateLighting, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
      <color attach="background" args={[night ? "#102b36" : "#a9d9d5"]} />
      <fog attach="fog" args={[night ? "#102b36" : "#a9d9d5", 8, 18]} />
      <ambientLight intensity={night ? 0.55 : 1.15} color={night ? "#83b5dc" : "#fff2cf"} />
      <directionalLight
        position={[-4, 7, 5]}
        intensity={night ? 0.65 : 2.2}
        color={night ? "#9bc7ff" : "#fff4d1"}
        castShadow
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color={night ? "#24545a" : "#72b6a0"} roughness={0.92} />
      </mesh>
      <gridHelper
        args={[BOARD_SIZE, 6, night ? "#5e9c96" : "#b4e2cc", night ? "#376c6d" : "#8bc8ae"]}
        position={[0, -0.025, 0]}
      />
      {buildings.map((item) => (
        <BuildingMesh key={item.id} item={item} />
      ))}
      {plants.map((item) => (
        <PlantMesh key={item.id} item={item} />
      ))}
      {residents.map((item) => (
        <ResidentMesh key={item.id} item={item} />
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
  const advanceTime = useWorldStore((state) => state.advanceTime);
  const recordInput = useWorldStore((state) => state.recordInput);
  const setActivityCategory = useWorldStore((state) => state.setActivityCategory);
  const activity = useWorldStore(selectActivity);
  useEffect(() => {
    let previous = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      advanceTime((now - previous) / 1000, now);
      previous = now;
    }, 1000);
    const onInput = (event: Event) => {
      if (event instanceof KeyboardEvent && event.altKey && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setActivityCategory(
          event.key === "1" ? "productivity" : event.key === "2" ? "leisure" : "idle",
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

  return (
    <main className="app">
      <Canvas shadows camera={{ position: [8, 8, 10], fov: 34 }} dpr={[1, 1.5]}>
        <World />
      </Canvas>
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
