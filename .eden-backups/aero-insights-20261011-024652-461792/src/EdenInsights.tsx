import { useEffect, useState } from "react";
import {
  BUILDING_CATALOG,
  MAX_BUILDING_FLOORS,
  buildingProgress,
  growthStage,
} from "./edenModels";
import type { Building } from "./simulation/types";
import {
  ACTIVITY_MILESTONE_POINTS,
  selectActivity,
  selectBuildings,
  selectProgression,
  selectResidents,
  useWorldStore,
} from "./state/worldStore";

// Matches the floor-count fallback used by buildBuilding in edenModels.ts.
function displayedFloors(building: Building, now: number): number {
  const config = BUILDING_CATALOG.find(item => item.id === building.variantId);
  const stage = growthStage(buildingProgress(building, now));
  const fallback = 1 + ((config?.floors ?? 1) - 1) * stage / 2;
  return Math.min(MAX_BUILDING_FLOORS, Math.max(1, Math.round(building.floors ?? fallback)));
}

export function BuildingInsights({
  buildingId,
  onClose,
}: {
  buildingId: string | null;
  onClose: () => void;
}) {
  const buildings = useWorldStore(selectBuildings);
  const residents = useWorldStore(selectResidents);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!buildingId) return;
    const interval = window.setInterval(() => setNow(Date.now()), 2_000);
    return () => window.clearInterval(interval);
  }, [buildingId]);

  useEffect(() => {
    if (!buildingId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buildingId, onClose]);

  const building = buildings.find(item => item.id === buildingId);
  if (!building) return null;

  const progress = Math.round(buildingProgress(building, now) * 100);
  const stage = growthStage(buildingProgress(building, now));
  const floors = displayedFloors(building, now);
  const footprint = building.footprint.width * building.footprint.depth;
  const builtSpace = footprint * floors;
  const totalBuiltSpace = buildings.reduce(
    (sum, item) => sum + item.footprint.width * item.footprint.depth * displayedFloors(item, now),
    0
  );
  const share = totalBuiltSpace > 0 ? builtSpace / totalBuiltSpace * 100 : 0;
  const residentCount = residents.filter(item => item.homeId === building.id).length;
  const moss = Math.round(Math.max(0, Math.min(1, building.moss ?? 0)) * 100);
  const title = building.name || BUILDING_CATALOG.find(item => item.id === building.variantId)?.name || "Building";

  return (
    <aside className="eden-insights eden-building-insights" role="dialog" aria-label={`${title} building details`}>
      <div className="eden-insights-top">
        <span className="eden-eyebrow">BUILDING INSIGHTS</span>
        <button type="button" className="eden-insights-close" onClick={onClose} aria-label="Close building details">×</button>
      </div>
      <h2>{title}</h2>
      <p className="eden-muted">{building.footprint.width} × {building.footprint.depth} grid cells · {['Starting', 'Growing', 'Mature'][stage]} stage</p>
      <div className="eden-stat-grid">
        <div><strong>{floors}</strong><span>Floors</span></div>
        <div><strong>{moss}%</strong><span>Moss</span></div>
        <div><strong>{residentCount}</strong><span>Residents</span></div>
      </div>
      <div className="eden-insights-row"><span>Building development</span><strong>{progress}%</strong></div>
      <div className="eden-meter"><div className="eden-meter-fill" style={{ width: `${progress}%` }} /></div>
      <div className="eden-insights-row"><span>Share of built floor-space</span><strong>{share.toFixed(1)}%</strong></div>
      <div className="eden-meter"><div className="eden-meter-fill eden-meter-blue" style={{ width: `${share}%` }} /></div>
      <p className="eden-muted eden-insights-note">Built floor-space is estimated from grid footprint × floors, not physical square footage.</p>
      <h3>How this building grows</h3>
      <p className="eden-muted">Productivity milestones add floors or new buildings. Leisure can add vegetation and moss; activity points gradually grow moss on existing buildings.</p>
      <p className="eden-muted eden-insights-note">Buildings currently do not generate activity points. They reflect your city’s growth and provide homes for residents.</p>
    </aside>
  );
}

export function ActivityStats() {
  const activity = useWorldStore(selectActivity);
  const progression = useWorldStore(selectProgression);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  const rows = [
    { key: 'productivity', label: 'Productivity', points: activity.productivityPoints, milestones: progression.consumedMilestones.productivity },
    { key: 'leisure', label: 'Leisure', points: activity.leisurePoints, milestones: progression.consumedMilestones.leisure },
    { key: 'idle', label: 'Idle', points: activity.idlePoints, milestones: progression.consumedMilestones.idle },
  ];
  const total = rows.reduce((sum, row) => sum + row.points, 0);

  return (
    <div
      className={`eden-activity-wrap${open ? ' is-open' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <button
        type="button"
        className="status"
        aria-expanded={open}
        aria-controls="eden-activity-stats"
        onClick={() => setPinned(value => !value)}
      >
        <i className={activity.category} />{activity.category}
      </button>
      <div id="eden-activity-stats" className="eden-insights eden-activity-popover" role="region" aria-label="Activity statistics">
        <div className="eden-eyebrow">ACTIVITY BREAKDOWN</div>
        <h2>City activity</h2>
        <p className="eden-muted">Current city day · resets at 4 AM</p>
        <div className="eden-insights-row"><span>Total activity points</span><strong>{total.toFixed(1)}</strong></div>
        {rows.map(row => {
          const percent = total > 0 ? row.points / total * 100 : 0;
          return (
            <div className="eden-activity-stat" key={row.key}>
              <div className="eden-insights-row">
                <span className={`eden-dot eden-dot-${row.key}`} />
                <span className="eden-activity-name">{row.label}</span>
                <strong>{percent.toFixed(0)}%</strong>
              </div>
              <div className="eden-meter"><div className={`eden-meter-fill eden-meter-${row.key}`} style={{ width: `${percent}%` }} /></div>
              <p className="eden-muted">{row.points.toFixed(1)} pts · {row.milestones} milestones applied</p>
            </div>
          );
        })}
        <p className="eden-muted eden-insights-note">During normal activity, 1 minute earns 1 point. Every {ACTIVITY_MILESTONE_POINTS} points can unlock a category milestone; extra awarded points also count.</p>
      </div>
    </div>
  );
}
