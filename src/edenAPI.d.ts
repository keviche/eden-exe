
import type { WorldState } from "./simulation/types";

declare global {
  interface Window {
    edenAPI?: {
      loadWorld: () => Promise<WorldState | null>;
      saveWorld: (world: WorldState) => Promise<boolean>;
    };
  }
}

export {};
