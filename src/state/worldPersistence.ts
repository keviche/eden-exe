
import { useWorldStore } from "./worldStore";

let initialized = false;

export async function initializeWorldPersistence(): Promise<void> {
  if (initialized) return;

  // The Electron API is unavailable in a regular browser.
  if (!window.edenAPI) return;

  const api = window.edenAPI;

  // Load the saved world before enabling automatic saves.
  try {
    const savedWorld = await api.loadWorld();

    if (savedWorld) {
      useWorldStore.getState().loadWorld(savedWorld);
    }
  } catch (error) {
    console.error("Failed to load saved world:", error);

    // Do not enable saving if loading failed.
    // Otherwise, we could overwrite an existing save.
    return;
  }

  // Serialize writes to prevent older saves from
  // finishing after newer saves.
  let saveQueue = Promise.resolve();

  useWorldStore.subscribe((state, previousState) => {
    if (state.world === previousState.world) return;

    const snapshot = structuredClone(state.world);

    saveQueue = saveQueue
      .catch(() => undefined)
      .then(async () => {
        await api.saveWorld(snapshot);
      })
      .catch((error) => {
        console.error("Failed to save world:", error);
      });
  });

  initialized = true;
}
