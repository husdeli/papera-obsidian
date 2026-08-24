# [PO-002] Plugin skeleton and mobile-safe HTTP

**Status**: Completed
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


### Settled in the interview (2026-08-23)

- **esbuild builds `main.js`, and its config is TypeScript**: `esbuild.config.ts` runs through `tsx`. Every file in the repository is TypeScript.
- **The HTTP client throws a typed error**: a failed request raises `PaperaHttpError`, which carries the status and the body. The per-project loop in PO-006 catches it to drop one project.
- **Vitest runs the unit tests**: it aliases the types-only `obsidian` package to a stub in one configuration line.
- **Three layers guard against a Node import**: esbuild fails to resolve a Node built-in, a post-build check scans the built `main.js`, and `eslint-plugin-obsidianmd` catches the import in the source.
- **`minAppVersion` is `1.13.0`**: PO-007 uses the declarative settings API `getSettingDefinitions()`. People on an older Obsidian cannot install the plugin.
- **`npm run dev` writes into a test vault**: an environment variable names the vault, and the build writes `main.js` and `manifest.json` into that vault's plugin folder.
- **`src/` is layered from the start**: the layout follows the `clean-fullstack-architecture` skill now, so PO-003 and PO-006 add files to a structure that already exists.

Assumptions that stand: the plugin ships no user interface framework, the HTTP client passes `throw: false` to `requestUrl` and parses the body itself, every subscription goes through `registerEvent`, `registerDomEvent` or `registerInterval`, and the mobile check is `app.emulateMobile(true)` plus one load on a phone.

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
