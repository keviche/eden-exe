# Eden.exe activity classification

Eden uses a purely deterministic, local classification engine.

Order of precedence:

1. Screen lock or system suspend -> Idle.
2. After 180 seconds without input: verified playing video in the foreground
   Chrome/Brave/Edge tab -> Leisure; known native video-player foreground app
   -> Leisure (heuristic); everything else -> Idle.
3. Before the AFK threshold: custom domain/app overrides, exact known website
   domains, known desktop application identities, then unrecognized -> Leisure.

Music-only playback **does not prevent Idle** and does not override whatever
foreground task you're doing.

The main Electron process uses `active-win` and `powerMonitor`. No URLs or
window titles are persisted in the event stream. Only the current activity
category, simple reason and active app name go to the React renderer.

To change rules, open Build -> Edit activity rules, or edit the `activity-rules.json`
file in Electron's `userData` folder. For full browser video detection, see
[browser-extension/README.md](browser-extension/README.md).

To test:

```bash
npm run test:activity
npm test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```
