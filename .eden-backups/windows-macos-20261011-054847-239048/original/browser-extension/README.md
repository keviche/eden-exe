# Eden.exe video companion (Chrome / Brave / Edge)

This optional, local-only extension provides the evidence that a video really is
playing. Without it, Eden will treat unattended browser tabs as idle after 3
minutes even if they are on Netflix or YouTube. Native players (VLC, IINA,
QuickTime Player, etc.) use a **foreground-app heuristic** instead; pausing one
of those apps while leaving it in front can still count as leisure.

1. Launch the Eden desktop app with `npm run dev:desktop`.
2. In Chrome, Brave or Edge, open `chrome://extensions`, enable Developer Mode,
   click **Load unpacked**, and select the `browser-extension` folder.
3. Open Eden's **Build** controls and click **Copy video pairing key**.
4. Click the extension icon, choose which browser you installed it in, paste
   the key, and click **Save pairing**.
5. Start a video on one of the supported websites and keep that tab in front.
   Leave the keyboard/mouse untouched for three minutes. Eden will stay in
   Leisure while the video is actually playing. Pause the video; once its
   playing state changes, Eden will show Idle if you are still AFK.

Video evidence is based on HTML `<video>` elements on the specified websites.
Some DRM players, embedded frames or custom players may not be detectable.
The extension does not track clicks, keystrokes, browsing history or media
content. It only sends the foreground tab's site hostname, title, and playback
boolean to `127.0.0.1:43761`, authenticated with the pairing key. The data is
kept only in memory by the app and expires within 10 seconds. The key is saved
locally in your browser profile and Eden's OS user-data folder.

### Custom activity rules

In Eden's **Build** controls, choose **Edit activity rules** to reveal
`activity-rules.json` in Finder. Edit it with a text editor:

```json
{
  "apps": {
    "my study program": "productivity",
    "com.example.unproductiveapp": "leisure"
  },
  "domains": {
    "example-university.edu": "productivity",
    "youtube.com": "leisure"
  }
}
```

App matches are case-insensitive exact *application name* or *macOS bundle ID*.
Website entries match exact hostnames and their subdomains, not similar-looking
names. Only `productivity` and `leisure` are valid values. Changes reload in up
to five seconds; restarting Eden is not required. Built-in lists are in
`electron/activityRules.cjs`.

The video companion does not work with Safari or Firefox as shipped. Its
playback signal does not treat music on Spotify or YouTube Music as activity.
