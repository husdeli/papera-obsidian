# [PO-002] Plugin skeleton and mobile-safe HTTP

**Status**: Not Started
**Priority**: Critical
**Effort**: S
**Category**: feature
**Created**: 2026-08-23

## Description

Set up the Obsidian plugin so that everything after it has somewhere to live. The plugin
builds to `main.js` and `manifest.json`, loads on desktop and on mobile, and makes every
HTTP call through Obsidian's `requestUrl`.

Mobile support is decided, not optional. A Node `fs` or `net` import anywhere in the bundle
breaks the plugin on mobile, so the build fails on one.

## Acceptance Criteria

- [ ] The build produces `main.js` and `manifest.json`.
- [ ] `manifest.json` sets `isDesktopOnly: false`.
- [ ] The plugin loads in a vault, and unloads without leaving a listener behind.
- [ ] One HTTP client wraps `requestUrl`, and it is the only place the plugin makes a request.
- [ ] The build fails when the bundle imports `fs`, `net`, `http`, `https`, `path`, `child_process` or `os`.
- [ ] Settings read and write through `loadData` and `saveData`, which land in `data.json`.
- [ ] The plugin loads on Obsidian mobile.

## Implementation Steps

1. **Build**: the project bundles TypeScript to a single `main.js` that Obsidian loads.
2. **Manifest**: `manifest.json` carries the plugin id `papera`, a name, a version and `isDesktopOnly: false`.
3. **HTTP client**: one module wraps `requestUrl` and exposes the request shapes the plugin needs. It handles the status codes and the JSON parsing in one place.
4. **Bundle guard**: a build check reads the output bundle and fails on a Node built-in import.
5. **Settings store**: one module owns `loadData` and `saveData`, and every other module reads settings through it.

## Decisions

- **`requestUrl`, not `fetch`**: `fetch` is subject to the origin rules of the Obsidian renderer, and `requestUrl` is not.
- **One HTTP client**: a single wrapper is what makes the bundle guard meaningful and the auth header automatic in PO-003.

## Technical Notes

### Data Requirements

- `data.json` holds the settings and, after PO-003, the tokens. Nothing else persists outside the vault.

### Architectural Considerations

- **The bundle guard is the mobile test that runs on every build.** Manual mobile testing catches a Node import late. The guard catches it at build time.

## Testing

- **Unit**: the HTTP client's status handling and JSON parsing.
- **Manual**:
  - [ ] Load the plugin in a desktop vault.
  - [ ] Load the plugin in a mobile vault.
  - [ ] Add a `fs` import and confirm the build fails.

## Related

- Related Tickets: PO-003, PO-004

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
