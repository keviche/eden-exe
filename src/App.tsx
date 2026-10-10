
import { useWorldStore, selectBuildings } from "./state/worldStore";
import "./App.css";

function App() {
  const buildings = useWorldStore(selectBuildings);
  const addBuilding = useWorldStore((state) => state.addBuilding);

  function handleAddBuilding() {
    addBuilding({
      type: "building",
      id: crypto.randomUUID(),
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
}

export default App;
