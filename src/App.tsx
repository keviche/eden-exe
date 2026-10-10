<<<<<<< Updated upstream

import { useWorldStore, selectBuildings } from "./state/worldStore";
=======
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useWorldStore } from "./simulation/store";
import type { Building, Plant, Resident } from "./simulation/types";
>>>>>>> Stashed changes
import "./App.css";

function point(x: number, z: number, width: number, depth: number) {
  return { x: (x / width - 0.5) * 8, z: (z / depth - 0.5) * 8 };
}

function BuildingMesh({ item }: { item: Building }) {
  const at = point(item.gridPosition.x, item.gridPosition.z, 100, 100);
  const height = item.name === "Solar Workshop" ? 1.35 : 0.9;
  return <group position={[at.x, 0, at.z]} rotation={[0, item.rotation, 0]}>
    <mesh position={[0, height / 2, 0]} castShadow><boxGeometry args={[0.58, height, 0.58]} /><meshStandardMaterial color="#9dd9c8" roughness={0.75} /></mesh>
    <mesh position={[0, height + 0.12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.52, 0.35, 4]} /><meshStandardMaterial color="#39a78b" roughness={0.8} /></mesh>
    <mesh position={[0, 0.33, 0.3]}><boxGeometry args={[0.16, 0.28, 0.025]} /><meshStandardMaterial color="#d8fff0" emissive="#69dcb7" emissiveIntensity={0.35} /></mesh>
  </group>;
}

function PlantMesh({ item }: { item: Plant }) {
  const at = point(item.gridPosition.x, item.gridPosition.z, 100, 100);
  const size = 0.2 + item.growth * 0.35;
  return <group position={[at.x, 0, at.z]}>
    <mesh position={[0, size / 2, 0]}><cylinderGeometry args={[0.025, 0.04, size, 5]} /><meshStandardMaterial color="#4f8e58" /></mesh>
    {[0, 1, 2].map((n) => <mesh key={n} position={[Math.cos(n * 2.1) * 0.11, size * (0.65 + (n % 2) * 0.15), Math.sin(n * 2.1) * 0.11]} rotation={[0, n * 2.1, 0.6]}><sphereGeometry args={[size * 0.32, 7, 5]} /><meshStandardMaterial color={item.species === "fern" ? "#62b77b" : "#39936c"} /></mesh>)}
  </group>;
}

function ResidentMesh({ item }: { item: Resident }) {
  return <mesh position={[item.position.x / 25, 0.15, item.position.z / 25]}><capsuleGeometry args={[0.09, 0.18, 3, 6]} /><meshStandardMaterial color="#e9b66e" /></mesh>;
}

function World() {
  const buildings = useWorldStore((s) => s.buildings);
  const plants = useWorldStore((s) => s.plants);
  const residents = useWorldStore((s) => s.residents);
  const night = new Date().getHours() < 6 || new Date().getHours() >= 19;
  return <>
    <color attach="background" args={[night ? "#102b36" : "#a9d9d5"]} />
    <fog attach="fog" args={[night ? "#102b36" : "#a9d9d5", 8, 18]} />
    <ambientLight intensity={night ? 0.55 : 1.15} color={night ? "#83b5dc" : "#fff2cf"} />
    <directionalLight position={[-4, 7, 5]} intensity={night ? 0.65 : 2.2} color={night ? "#9bc7ff" : "#fff4d1"} castShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[9, 9]} /><meshStandardMaterial color={night ? "#24545a" : "#72b6a0"} roughness={0.92} /></mesh>
    <gridHelper args={[9, 18, night ? "#5e9c96" : "#b4e2cc", night ? "#376c6d" : "#8bc8ae"]} position={[0, -0.025, 0]} />
    {buildings.map((item) => <BuildingMesh key={item.id} item={item} />)}
    {plants.map((item) => <PlantMesh key={item.id} item={item} />)}
    {residents.map((item) => <ResidentMesh key={item.id} item={item} />)}
    <OrbitControls enablePan={false} minDistance={7} maxDistance={13} maxPolarAngle={Math.PI / 2.15} />
  </>;
}

function App() {
<<<<<<< Updated upstream
  const buildings = useWorldStore(selectBuildings);
  const addBuilding = useWorldStore((state) => state.addBuilding);

  function handleAddBuilding() {
    addBuilding({
      type: "building",
      id: crypto.randomUUID(),
      variantId: "solar-house",
      name: "Solar House",
      gridPosition: {
        x: buildings.length * 3,
        z: 0,
      },
      footprint: {
        width: 2,
        depth: 2,
      },
      rotation: 0,
      createdAt: Date.now(),
    });
  }

  return (
    <div className="app">
      <h1
        style={{
          color: "#00d9ff",
          padding: "20px",
          fontSize: "28px",
          textShadow: "0 0 12px rgba(0, 217, 255, 0.6)",
        }}
      >
        EDEN.EXE
      </h1>

      <div style={{ padding: "0 20px", color: "white" }}>
        <p>Buildings: {buildings.length}</p>

        <button onClick={handleAddBuilding}>
          Add Test Building
        </button>

        <ul>
          {buildings.map((building) => (
            <li key={building.id}>
              {building.name} — ({building.gridPosition.x},{" "}
              {building.gridPosition.z})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
=======
  const tick = useWorldStore((s) => s.tick);
  const recordInput = useWorldStore((s) => s.recordInput);
  const setActivity = useWorldStore((s) => s.setActivity);
  const activity = useWorldStore((s) => s.activity);
  useEffect(() => {
    let previous = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      tick((now - previous) / 1000, now);
      previous = now;
    }, 1000);
    const onInput = (event: Event) => {
      if (event instanceof KeyboardEvent && event.altKey && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setActivity(event.key === "1" ? "productivity" : event.key === "2" ? "leisure" : "idle");
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
  }, [recordInput, setActivity, tick]);
  return <main className="app">
    <Canvas shadows camera={{ position: [8, 8, 10], fov: 34 }} dpr={[1, 1.5]}>
      <World />
    </Canvas>
    <div className="wordmark">EDEN<span>.EXE</span></div>
    <div className="status"><i className={activity} />{activity}</div>
  </main>;
>>>>>>> Stashed changes
}

export default App;
