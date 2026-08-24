# Papera for Obsidian — repository map

The repository holds one Obsidian plugin. The plugin syncs Papera projects into one reserved
root folder in a single vault. The product decisions live in `.clean-architecture/`.

## Layout

- `src/main.ts` — the plugin class Obsidian loads. It is the composition root and holds no logic.
- `src/config/` — the values that change per environment, in `.config.ts` modules.
- `src/models/` — the typed shapes every layer names. This layer imports nothing.
- `src/services/` — the modules that talk to the outside world.
- `scripts/` — the build checks.
- `test/` — the unit tests. The folders mirror the folders they cover.

`src/` follows the layers of the `clean-fullstack-architecture` skill. Add a layer folder when
a file needs it, and not before.

## Rules

- `src/services/paperaHttpClient.ts` is the only module that names `requestUrl`. Nothing else
  makes a request, and nothing calls `request`, `fetch`, `XMLHttpRequest` or `WebSocket`.
- The HTTP client receives the full URL and the headers from its caller. It reads no settings
  and holds no base URL. The caller joins the origin from `src/config/papera.config.ts`.
- `src/services/PaperaSettingsStore.ts` is the only module that names `loadData` or `saveData`.
  It builds no file path, because Obsidian owns `data.json`.
- The settings store checks the type of every saved field, because `loadData()` returns `any`.
  A field that fails the check falls back to its default.
- Every subscription goes through `registerEvent`, `registerDomEvent` or `registerInterval`,
  so Obsidian detaches it on unload.
- `esbuild.config.ts` is the only file that reads `process.env`.

## The three guards against a Node import

A Node built-in in the bundle breaks the plugin on mobile. Three checks stand in the way:

1. `esbuild.config.ts` lists no Node built-in in `external`, so esbuild fails to resolve one.
2. `npm run build` runs `scripts/checkBundle.ts`, which scans the built `main.js`.
3. `npm run lint` runs `obsidianmd/no-nodejs-modules` over `src/` as an error.

## Deferrals

- The Papera origin in `src/config/papera.config.ts` is a placeholder. PO-003 confirms the value
  when it adds OAuth sign-in.
- The release workflow and the submission to the community plugin list belong to a later ticket.
  The version stays `0.1.0` until then.
