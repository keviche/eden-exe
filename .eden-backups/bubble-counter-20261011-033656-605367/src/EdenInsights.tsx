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

// aero-insights-v3-pie: true proportional SVG pie slices.
const PIE_CENTER = 150;
const PIE_RADIUS = 132;

function piePoint(degrees: number, radius: number) {
  const radians = degrees * Math.PI / 180;
  return {
    x: PIE_CENTER + Math.cos(radians) * radius,
    y: PIE_CENTER + Math.sin(radians) * radius,
  };
}

function piePath(startDegrees: number, sweepDegrees: number) {
  const first = piePoint(startDegrees, PIE_RADIUS);
  const last = piePoint(startDegrees + sweepDegrees, PIE_RADIUS);
  const largeArc = sweepDegrees > 180 ? 1 : 0;
  return `M ${PIE_CENTER} ${PIE_CENTER} L ${first.x} ${first.y} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${last.x} ${last.y} Z`;
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

  // Percentages and sector angles all come from the same real activity totals.
  let cursor = -90;
  const slices = rows.map(row => {
    const fraction = total > 0 ? Math.max(0, row.points) / total : 0;
    const sweep = Math.min(360, fraction * 360);
    const start = cursor;
    cursor += sweep;
    const mid = start + sweep / 2;
    const isSmall = fraction < 0.12;
    const position = piePoint(mid, isSmall ? 99 : fraction < 0.22 ? 88 : 76);
    return { ...row, fraction, sweep, start, isSmall, position };
  });

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
        <div className="eden-day-progress">
          <div className="eden-insights-row">
            <span>Day progress</span><strong>{dayProgress.toFixed(0)}%</strong>
          </div>
          <div className="eden-meter" role="progressbar" aria-label="Current city day progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dayProgress)}>
            <div className="eden-meter-fill eden-meter-day" style={{ width: `${dayProgress}%` }} />
          </div>
          <span className="eden-day-subtitle">4 AM → 4 AM</span>
        </div>
        <h2>Activity breakdown</h2>
        <div className="eden-pie-figure">
          <svg
            className="eden-pie-svg"
            viewBox="0 0 300 300"
            role="img"
            aria-label={slices.map(slice => `${slice.label}: ${Math.round(slice.fraction * 100)} percent, ${slice.milestones} milestones`).join('; ')}
          >
            <defs>
              <radialGradient id="eden-aero-pie-productivity" cx="24%" cy="16%" r="97%">
                <stop offset="0%" stopColor="#c1fff0" />
                <stop offset="45%" stopColor="#58dcbf" />
                <stop offset="100%" stopColor="#139baa" />
              </radialGradient>
              <radialGradient id="eden-aero-pie-leisure" cx="24%" cy="16%" r="97%">
                <stop offset="0%" stopColor="#fff8ce" />
                <stop offset="49%" stopColor="#f4c977" />
                <stop offset="100%" stopColor="#eaa65f" />
              </radialGradient>
              <radialGradient id="eden-aero-pie-idle" cx="24%" cy="16%" r="97%">
                <stop offset="0%" stopColor="#effbff" />
                <stop offset="45%" stopColor="#9ad5f0" />
                <stop offset="100%" stopColor="#62a4ca" />
              </radialGradient>
            </defs>
            {total <= 0 ? (
              <g>
                <circle cx={PIE_CENTER} cy={PIE_CENTER} r={PIE_RADIUS} fill="#ccecf2" stroke="#ffffff" strokeWidth={2} />
                <text x={PIE_CENTER} y={PIE_CENTER - 6} textAnchor="middle" className="eden-pie-label">
                  <tspan x={PIE_CENTER} fontSize="21">0%</tspan>
                  <tspan x={PIE_CENTER} dy="19" fontSize="11">0 milestones</tspan>
                </text>
              </g>
            ) : (
              slices.filter(slice => slice.sweep > 0).map(slice => (
                <g key={slice.key}>
                  <title>{`${slice.label}: ${(slice.fraction * 100).toFixed(1)}%, ${slice.milestones} milestones`}</title>
                  {slice.sweep >= 359.999 ? (
                    <circle cx={PIE_CENTER} cy={PIE_CENTER} r={PIE_RADIUS} fill={`url(#eden-aero-pie-${slice.key})`} stroke="#faffff" strokeWidth={2} />
                  ) : (
                    <path d={piePath(slice.start, slice.sweep)} fill={`url(#eden-aero-pie-${slice.key})`} stroke="#faffff" strokeWidth={2} strokeLinejoin="round" />
                  )}
                  <text
                    x={slice.position.x}
                    y={slice.position.y - (slice.isSmall ? 4 : 7)}
                    textAnchor="middle"
                    className={`eden-pie-label${slice.isSmall ? ' eden-pie-label-small' : ''}`}
                  >
                    <tspan x={slice.position.x} fontSize={slice.isSmall ? 12 : 19}>{Math.round(slice.fraction * 100)}%</tspan>
                    <tspan x={slice.position.x} dy={slice.isSmall ? 11 : 18} fontSize={slice.isSmall ? 8 : 11}>{slice.milestones} milestones</tspan>
                  </text>
                </g>
              ))
            )}
          </svg>
          <div className="eden-pie-legend" aria-label="Activity categories">
            {rows.map(row => (
              <span key={row.key}>
                <i className={`eden-dot eden-dot-${row.key}`} aria-hidden="true" />
                {row.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
