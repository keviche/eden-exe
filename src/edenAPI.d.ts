import type { WorldState } from "./simulation/types";

// System activity status reported by Electron
export type ActivityStatus = "active" | "idle";

// Activity event sent from Electron
export interface ActivityEvent {
  status: ActivityStatus;
  idleSeconds: number;
  timestamp: number;
}

declare global {
  interface Window {
    edenAPI?: {
      // Existing world persistence
      loadWorld: () => Promise<WorldState | null>;

      saveWorld: (world: WorldState) => Promise<boolean>;

      // Get current system activity
      getCurrentActivity: () => Promise<ActivityEvent | null>;

      // Subscribe to activity changes
      onActivityChanged: (
        callback: (activity: ActivityEvent) => void
      ) => () => void;
    };
  }
}

export {};