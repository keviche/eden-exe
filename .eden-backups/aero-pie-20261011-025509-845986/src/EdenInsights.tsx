// aero-insights-v2: minimal, glassy Frutiger Aero interface.
import { useCallback, useEffect, useState } from "react";
import {
  BUILDING_CATALOG,
  MAX_BUILDING_FLOORS,
  buildingProgress,
  growthStage,
} from "./edenModels";
import type { Building } from "./simulation/types";
import {
  selectActivity,
  selectBuildings,
  selectProgression,
  selectResidents,
  useWorldStore,
} from "./state/worldStore";

// Mirrors the displayed building floor calculation used by the renderer.
function displayedFloors(building: Building, now: number): number {
  const config = BUILDING_CATALOG.find(item => item.id === building.variantId);
  const stage = growthStage(buildingProgress(building, now));
  const fallback = 1 + ((config?.floors ?? 1) - 1) * stage / 2;
  return Math.min(MAX_BUILDING_FLOORS, Math.max(1, Math.round(building.floors ?? fallback)));
}

// The city's statistics reset at local 4 AM; unlike a fixed 24h calculation,
// calculating consecutive local 4 AM boundaries also handles DST changes.
function cityDayPercentage(timestamp: number): number {
  const start = new Date(timestamp);
  start.setHours(4, 0, 0, 0);
  if (timestamp < start.getTime()) start.setDate(start.getDate() - 1);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const duration = Math.max(1, end.getTime() - start.getTime());
  return Math.max(0, Math.min(100, (timestamp - start.getTime()) / duration * 100));
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
  const floors = displayedFloors(building, now);
  const residentCount = residents.filter(item => item.homeId === building.id).length;
  const moss = Math.round(Math.max(0, Math.min(1, building.moss ?? 0)) * 100);
  const title = building.name || BUILDING_CATALOG.find(item => item.id === building.variantId)?.name || "Building";

  return (
    <aside className="eden-insights eden-building-insights" role="dialog" aria-label={`${title} building details`}>
      <div className="eden-insights-top">
        <span className="eden-eyebrow">EDEN / BUILDING</span>
        <button type="button" className="eden-insights-close" onClick={onClose} aria-label="Close building details">×</button>
      </div>
      <h2>{title}</h2>
      <div className="eden-grid-pill">{building.footprint.width} × {building.footprint.depth} <span>CELLS</span></div>
      <div className="eden-stat-grid">
        <div><strong>{floors}</strong><span>Floors</span></div>
        <div><strong>{moss}%</strong><span>Moss</span></div>
        <div><strong>{residentCount}</strong><span>Residents</span></div>
      </div>
      <div className="eden-insights-row eden-development-label">
        <span>Development</span><strong>{progress}%</strong>
      </div>
      <div className="eden-meter" role="progressbar" aria-label="Building development" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="eden-meter-fill" style={{ width: `${progress}%` }} />
      </div>
    </aside>
  );
}

export function ActivityStats() {
  const activity = useWorldStore(selectActivity);
  const progression = useWorldStore(selectProgression);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const open = !dismissed && (hovered || focused || pinned);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // X and Escape suppress the hover/focus trigger until pointer exits,
  // focus leaves, or the status button is explicitly clicked again.
  const close = useCallback(() => {
    setDismissed(true);
    setPinned(false);
    setHovered(false);
    setFocused(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const rows = [
    { key: "productivity", label: "Productivity", points: activity.productivityPoints, milestones: progression.consumedMilestones.productivity },
    { key: "leisure", label: "Leisure", points: activity.leisurePoints, milestones: progression.consumedMilestones.leisure },
    { key: "idle", label: "Idle", points: activity.idlePoints, milestones: progression.consumedMilestones.idle },
  ];
  const total = rows.reduce((sum, row) => sum + row.points, 0);
  const dayProgress = cityDayPercentage(now);

  return (
    <div
      className={`eden-activity-wrap${open ? " is-open" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDismissed(false); }}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
          setDismissed(false);
        }
      }}
    >
      <button
        type="button"
        className="status"
        aria-expanded={open}
        aria-controls="eden-activity-stats"
        onClick={() => {
          if (open && pinned) close();
          else { setDismissed(false); setPinned(true); }
        }}
      >
        <i className={activity.category} />{activity.category}
      </button>
      <div
        id="eden-activity-stats"
        className="eden-insights eden-activity-popover"
        role="region"
        aria-label="Activity statistics"
        aria-hidden={!open}
      >
        <div className="eden-insights-top">
          <span className="eden-eyebrow">EDEN / ACTIVITY</span>
          <button type="button" tabIndex={open ? 0 : -1} className="eden-insights-close" onClick={close} aria-label="Close activity statistics">×</button>
        </div>
        <h2>Activity breakdown</h2>
        <div className="eden-insights-row eden-activity-total">
          <span>Activity points</span><strong>{total.toFixed(1)}</strong>
        </div>
        {rows.map(row => {
          const percent = total > 0 ? row.points / total * 100 : 0;
          return (
            <div className="eden-activity-stat" key={row.key}>
              <div className="eden-insights-row">
                <span className={`eden-dot eden-dot-${row.key}`} />
                <span className="eden-activity-name">{row.label}</span>
                <strong>{percent.toFixed(0)}%</strong>
              </div>
              <div className="eden-meter">
                <div className={`eden-meter-fill eden-meter-${row.key}`} style={{ width: `${percent}%` }} />
              </div>
              <p className="eden-muted">{row.points.toFixed(1)} pts · {row.milestones} milestones</p>
            </div>
          );
        })}
        <div className="eden-day-progress">
          <div className="eden-insights-row">
            <span>Day progress</span><strong>{dayProgress.toFixed(0)}%</strong>
          </div>
          <div className="eden-meter" role="progressbar" aria-label="Current city day progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(dayProgress.toFixed(0))}>
            <div className="eden-meter-fill eden-meter-day" style={{ width: `${dayProgress}%` }} />
          </div>
          <span className="eden-day-subtitle">4 AM → 4 AM</span>
        </div>
      </div>
    </div>
  );
}
