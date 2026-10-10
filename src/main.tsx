
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { initializeWorldPersistence } from "./state/worldPersistence";

import "./index.css";

async function startApp() {
  // Load the saved world before rendering React.
  await initializeWorldPersistence();

  // Mount the React application.
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp();
