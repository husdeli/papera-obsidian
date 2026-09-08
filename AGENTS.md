# Papera for Obsidian — repository map

The repository holds one Obsidian plugin. The plugin syncs Papera projects into one reserved
root folder in a single vault. The product decisions live in `.sdlc/`.

## Layout

- `src/main.ts` — the plugin class Obsidian loads. It is the composition root and holds no logic.
- `src/config/` — the values that change per environment, in `.config.ts` modules.
- `src/models/` — the typed shapes every layer names. This layer imports nothing.
- `src/domain/` — the pure modules that hold no state and import nothing from `obsidian`.
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
  token at a time. It writes no vault file directly, and it records the Papera account through
  `PaperaVaultIndex`.
- `src/services/PaperaVault.ts` is the only module that names `app.vault`, `app.vault.adapter` or
  `app.metadataCache`. Every method runs the scope check on its path first, and it returns
  project-owned shapes, so no caller names `CachedMetadata` or `FrontMatterCache`.
- A folder inside the vault is created with `Vault.createFolder`, never `adapter.mkdir`, because
  a folder made through the adapter is missing from the vault's own cache.
- `src/services/PaperaVaultIndex.ts` is the only module that reads or writes
  `.papera-index.json`, and it writes the file only when the reserved root folder already exists.
- `src/services/PaperaVaultMap.ts` holds the id-to-path map in memory, and no module writes that
  map to disk. It is rebuilt from note frontmatter at every launch. It also answers the id at a
  path, from a reverse map that only `put` fills, so no caller can fill one map and forget the
  other. A rebuild from frontmatter drops the note titles the last pull recorded, because
  frontmatter carries no title, so a title is unknown until the next pull records it.
- Every `Vault` event subscription is registered inside `Workspace.onLayoutReady`, and only after
  `PaperaVaultMap.ready()` resolves. That accessor resolves once the map build finishes, and it
  resolves with an empty map when the reserved root folder does not exist, so no caller waits on
  a build that had nothing to walk. The `MetadataCache` `resolved` handler that starts the map
  build is the one exception, because it is what makes the map ready.
- `src/services/paperaAuthorizedHttpClient.ts` is the only module that writes an `Authorization`
  header. Every Papera request goes through it, and the caller writes no header of its own.
- Every subscription goes through `registerEvent`, `registerDomEvent` or `registerInterval`,
  so Obsidian detaches it on unload.
- `src/domain/paperaMarkdownSpans.ts` is the only module that names `fromMarkdown`. It answers
  which spans of a note body a rule may rewrite, and every rule splices at the offsets it reports.
- The plugin's runtime dependencies are the ones listed under `dependencies` in `package.json`.
  A hand-written Markdown scanner is not an option, because every CommonMark edge case would
  become a bug of ours that corrupts a person's text.
- PO-006 and PO-011 translate a note body through `src/domain/paperaLinkToWikilink.ts` and
  `src/domain/paperaWikilinkToLink.ts`, and hold no translation logic of their own.
- `esbuild.config.ts` is the only file that reads `process.env`.
- `.sdlc/sync-requirements.md` is the only file that names what the plugin
  needs from Papera. It names needs, never a design: no address, no field, no message, no
  code. How Papera meets a need is decided and built with the Papera application, never from
  this repository. A new need becomes a numbered row there, and a ticket cites the number.

## The three guards against a Node import

A Node built-in in the bundle breaks the plugin on mobile. Three checks stand in the way:

1. `esbuild.config.ts` lists no Node built-in in `external`, so esbuild fails to resolve one.
2. `npm run build` runs `scripts/checkBundle.ts`, which scans the built `main.js`.
3. `npm run lint` runs `obsidianmd/no-nodejs-modules` over `src/` as an error.

## Deferrals

- The release workflow and the submission to the community plugin list belong to a later ticket.
  The version stays `0.1.0` until then.
- Changing the reserved root folder name in the settings after a sync, and renaming the reserved
  root folder in the vault, belong to a later ticket. PO-004 reads the setting once at load and
  moves no folder.
