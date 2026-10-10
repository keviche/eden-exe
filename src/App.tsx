
import { useWorldStore, selectBuildings } from "./state/worldStore";
import "./App.css";

function App() {
  const buildings = useWorldStore(selectBuildings);
  const addBuilding = useWorldStore((state) => state.addBuilding);
  const resetWorld = useWorldStore((state) => state.resetWorld);

  function handleAddBuilding() {
    const gridSize = 6;
    const buildingSize = 2;

    // Find an available 2x2 area within the 6x6 grid.
    for (let z = 0; z < gridSize; z += buildingSize) {
      for (let x = 0; x < gridSize; x += buildingSize) {
        const occupied = buildings.some((building) => {
          return (
            x < building.gridPosition.x + building.footprint.width &&
            x + buildingSize > building.gridPosition.x &&
            z < building.gridPosition.z + building.footprint.depth &&
            z + buildingSize > building.gridPosition.z
          );
        });

        if (!occupied) {
          addBuilding({
            type: "building",
            id: crypto.randomUUID(),
            variantId: "solar-house",
            name: "Solar House",
            gridPosition: {
              x,
              z,
            },
            footprint: {
              width: buildingSize,
              depth: buildingSize,
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

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <button onClick={handleAddBuilding}>
            Add Test Building
          </button>

          <button onClick={handleResetWorld}>
            Reset World
          </button>
        </div>

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
