
import { useState } from "react";
import type { CSSProperties } from "react";
import { useWorldStore } from "./state/worldStore";

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: 9,
  background: "rgba(116, 167, 133, 0.12)",
  border: "1px solid rgba(190, 230, 204, 0.25)",
};

const buttonStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid #779e8b",
  background: "#dcebd8",
  color: "#183e38",
  cursor: "pointer",
  font: "inherit",
};

const PRESETS = [
  { label: "⏩ Small Growth", points: 5 },
  { label: "⏩ Medium Growth", points: 15 },
  { label: "⏩⏩ Massive Growth", points: 30 },
];

export default function FastForwardControls() {
  const addActivityPoints = useWorldStore(
    (state) => state.addActivityPoints
  );

  const [lastAction, setLastAction] = useState("");

  function fastForward(points: number) {
    // Normal building development
    addActivityPoints("productivity", points);

    // Nature grows three times faster
    addActivityPoints("leisure", points * 3);

    // Residents continue to populate the city
    addActivityPoints("idle", points);

    setLastAction(
      `Buildings +${points}, nature +${points * 3}, residents +${points}`
    );
  }

  return (
    <section style={containerStyle}>
      <strong>🌿 Fast Forward Development</strong>

      <small>
        Rapidly grow buildings, trees, flowers,
        vegetation, and residents.
      </small>

      {PRESETS.map((preset) => (
        <button
          key={preset.points}
          type="button"
          style={buttonStyle}
          onClick={() => fastForward(preset.points)}
        >
          {preset.label}
        </button>
      ))}

      {lastAction && (
        <small role="status">{lastAction}</small>
      )}
    </section>
  );
}
