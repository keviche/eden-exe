# EDEN.EXE

EDEN.EXE is a lightweight desktop companion featuring a growing 3D miniature world that responds to computer activity.

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

A transparent Electron window should appear near the bottom-left of your desktop.

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
- **Simulation:** Activity-driven world progression (planned)

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

The transparent Electron desktop scaffold is working. Procedural world generation, activity monitoring, simulation, persistence, and the shared world store are upcoming development tasks.
