# EDEN.EXE

EDEN.EXE is a lightweight desktop companion featuring a growing 3D miniature world that responds to computer activity. It is a background application that tracks what the user is doing and modifies a small solar punk/frutiger aero city depending on user action. It will be a small window that sits in the bottom right corner of your screen and is 3D. Should shift between day and night cycle. Likely 3 sections that different user actions will fit into, these being productivity, leisure, and no input at all. Each one will correspond to either the city growing, people reproducing, or the plant life expanding.

Built with Electron, React, TypeScript, Vite, Three.js, React Three Fiber, Drei, and Zustand.

## Prerequisites

- macOS (primary development platform)
- Git
- Node.js 24.21.0 (specified in `.nvmrc`)
- npm 12.2.0 (recommended)
- nvm (recommended for managing Node.js versions)

## Getting Started

Clone the repository:

```bash
git clone https://github.com/keviche/eden-exe.git
cd eden-exe
```

Set up Node.js:

```bash
nvm install
nvm use
npm install -g npm@12.2.0
```

Install dependencies:

```bash
npm ci
```

Launch the Electron desktop application:

```bash
npm run dev:desktop
```

A transparent Electron window should appear near the bottom-right of your desktop.

Press `Ctrl + C` in Terminal to stop the application.

## Development Commands

| Command                | Description                 |
| ---------------------- | --------------------------- |
| `npm run dev:desktop`  | Start Vite and Electron     |
| `npm run dev`          | Start Vite in the browser   |
| `npm run typecheck`    | Check TypeScript types      |
| `npm run lint`         | Run Oxlint                  |
| `npm run format`       | Format files using Prettier |
| `npm run format:check` | Check formatting            |
| `npm test`             | Run Vitest tests            |
| `npm run build`        | Build the React frontend    |

## Project Structure

```text
electron/       Electron main process and preload
src/            React application
src/tests/      Automated tests
public/         Static assets
```

## Architecture

- **Electron:** Desktop window, lifecycle, and operating-system integration
- **React:** User interface
- **React Three Fiber / Three.js:** 3D world rendering
- **Zustand:** Shared world and simulation state
- **Simulation:** Activity-driven world progression and local persistence

The Electron main process communicates with the renderer through a controlled IPC interface. The renderer owns the Zustand store.

## Contributing

Create a feature branch before implementing a ticket:

```bash
git switch -c feature/your-feature
```

Commit and push your work:

```bash
git add .
git commit -m "Describe your changes"
git push -u origin feature/your-feature
```

Open a pull request targeting `main` for review.

## Current Status

The initial version renders a small 3D world with procedural buildings, plants, and residents. Its Zustand store persists progression in browser storage. Keyboard and pointer input count as active use; after 60 seconds without input, the world enters idle mode. Use **Alt+1** for productivity, **Alt+2** for leisure, and **Alt+3** for idle. Productivity adds buildings, leisure adds residents, and idle time expands plant life.

The app does not inspect other applications, so active use is not automatically classified as productivity or leisure. The activity shortcuts provide that classification for now.
