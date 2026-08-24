# Papera for Obsidian — repository map

The repository holds one Obsidian plugin. The plugin syncs Papera projects into one reserved
root folder in a single vault. The product decisions live in `.clean-architecture/`.

## Layout

- `src/main.ts` — the plugin class Obsidian loads. It is the composition root and holds no logic.
- `src/config/` — the values that change per environment, in `.config.ts` modules.
- `src/models/` — the typed shapes every layer names. This layer imports nothing.
- `src/services/` — the modules that talk to the outside world.
- `src/ui/` — the settings tab Obsidian renders.
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
- The settings store owns the settings in memory. Every writer changes one field through
  `PaperaSettingsStore.update`, and no other module builds a whole `PaperaSettings`. Two writers
  of `data.json` can restore a revoked refresh token and sign the vault out.
- `src/services/PaperaSession.ts` is the only module that holds a Papera token. It refreshes one
  token at a time, and it reads and writes no vault file.
- `src/services/paperaAuthorizedHttpClient.ts` is the only module that writes an `Authorization`
  header. Every Papera request goes through it, and the caller writes no header of its own.
- Every subscription goes through `registerEvent`, `registerDomEvent` or `registerInterval`,
  so Obsidian detaches it on unload.
- `esbuild.config.ts` is the only file that reads `process.env`.

## The three guards against a Node import

A Node built-in in the bundle breaks the plugin on mobile. Three checks stand in the way:

1. `esbuild.config.ts` lists no Node built-in in `external`, so esbuild fails to resolve one.
2. `npm run build` runs `scripts/checkBundle.ts`, which scans the built `main.js`.
3. `npm run lint` runs `obsidianmd/no-nodejs-modules` over `src/` as an error.

## Deferrals

- The release workflow and the submission to the community plugin list belong to a later ticket.
  The version stays `0.1.0` until then.
