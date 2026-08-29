# [PO-004] Reserved root, name safety and the vault index

**Status**: Completed
**Priority**: Critical
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Build the three pieces every later ticket depends on: the check that keeps the plugin inside
its own folder, the function that turns a Papera project name into a safe folder name, and
the map from a Papera id to a vault path.

**Warning**: the scope check protects the user's own notes. Every vault read and every vault
write passes through it. A missing check lets the plugin delete a note it does not own.

The map is built in memory from the `papera_id` values in note frontmatter, which Obsidian
already holds in `MetadataCache`. Only one fact cannot be recovered from the vault or from
Papera: which Papera account the reserved root belongs to. That one fact is the whole content
of `.papera-index.json` in this ticket.

## Acceptance Criteria

- [x] The reserved root folder name is a setting, and it defaults to `Papera`.
- [x] One function answers whether a vault path is inside the reserved root, and every vault read and write calls it first.
- [x] A path outside the reserved root is never read and never written.
- [x] One function turns a project name or a workflow name into a folder name that removes or replaces `/ \ : * ? " < > | # ^ [ ]`.
- [x] The same function handles a Windows reserved device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`), a control character, and a name longer than 255 bytes.
- [x] A project name with a leading dot, a trailing dot or a trailing space produces a folder name with none of them.
- [x] A project name that sanitizes to an empty string produces a stable fallback name.
- [x] Two projects whose names sanitize to the same string produce two distinct folders, and so do two workflows inside one project. The result depends on the Papera ids alone, so two devices agree.
- [x] The plugin holds an in-memory map from a Papera id to a vault path, built from the `papera_id` values in note frontmatter.
- [ ] The map is keyed by id, so a project or workflow rename in Papera moves the folder rather than creating a second one. PO-006 completes this, because PO-004 writes no project folder. The unit tests prove the mechanism: the map is keyed by id and rebuilt from frontmatter at every launch.
- [x] The plugin builds the map before it subscribes to any vault event.
- [x] `.papera-index.json` lives under the reserved root and records which Papera account the reserved root belongs to. It records nothing else.
- [x] The account record survives a plugin reinstall, which clears `data.json`. The unit test of the read and write round trip is the proof in PO-004. The manual confirmation waits for the first pull, because PO-004 creates no reserved root folder and never writes the file in production before then.
- [x] A missing or unreadable `.papera-index.json` is treated as absent. The plugin carries on and writes the file again. The unit tests cover the four failure kinds and the startup write. The manual confirmation waits for the first pull, for the same reason.
- [x] The second-account refusal in PO-003 reads the account recorded in `.papera-index.json`.

## Implementation Steps

1. **Setting**: the reserved root folder name reads from `data.json` with the default `Papera`.
2. **Scope check**: one function takes a vault path and answers whether the plugin manages it.
3. **Name safety**: one function sanitizes a project name for the filesystem, for Obsidian and for wikilinks.
4. **Uniqueness**: the sanitizer takes a whole sibling set, so a duplicate gets a distinct suffix that no caller's ordering can change.
5. **The map**: one module builds and holds the id-to-path map in memory, reading frontmatter through `MetadataCache`.
6. **The account file**: one module reads and writes `.papera-index.json`, which holds a schema version and the account id.
7. **Startup order**: the plugin builds the map before it subscribes to vault events, so Obsidian's own startup events do not look like user edits.

## Decisions

- **The map is in memory, not on disk.** The `papera_id` in a note's frontmatter is the source of truth, and Obsidian already holds every note's frontmatter in `MetadataCache`. A map cached to disk would be a second copy of something the vault and Papera already hold, and it would need its own repair path, its own rename bookkeeping and its own corruption states.
- **A folder proves its identity through Papera.** A folder carries no frontmatter. The plugin reads a `papera_id` from a note inside the folder and asks Papera which project and workflow that content unit belongs to. PO-006 answers that by inverting the project listing it already reads (R8, R9), so Papera needs to supply nothing new.
- **An empty workflow folder is adopted by nothing.** It holds no note, so no `papera_id` names it. The next pull re-creates it.
- **`.papera-index.json` holds the account and nothing else.** It is the one fact that neither the vault nor Papera can return after a reinstall clears `data.json`.
- **The file keeps its name, because it becomes an index again.** PO-008 adds a map from an attachment storage key to a vault path. An attachment is a binary file with no frontmatter, so its Papera id genuinely cannot be recovered from the vault. Renaming the file now and again at PO-008 would churn six tickets twice.
- **The file stays hidden.** The person never sees it, and only the Adapter API reaches it. Obsidian Sync carries no hidden file, so a second device writes its own. A one-field file costs nothing to write again.
- **A corrupt account file is treated as absent.** There is nothing in a one-field file to lose, so the plugin overwrites it rather than refusing to work. A sign-in against a populated reserved root is still guarded: a content unit the signed-in account does not own answers `404` or `403` (R52).
- **A duplicate folder name takes a short id suffix, not a counter.** `Book Club`, then `Book Club (a3f9c2)`. A counter depends on which project synced first, so two devices would disagree.
- **The sanitizer applies every platform's rules on every platform.** One vault moves between devices.

## Technical Notes

### Data Requirements

- `.papera-index.json` records a schema version and the Papera account id. In PO-008 it also records each attachment storage key and its vault path.
- The in-memory map holds, per Papera id, the vault path of its project folder, workflow folder or note, plus the last known revision per content unit from the note's `papera_rev`.

### Architectural Considerations

- **Wikilink safety goes beyond filesystem safety.** Obsidian reads `|`, `#`, `^`, `[` and `]` inside a `[[wikilink]]`, so a folder name containing one breaks a link that points into it.
- **`normalizePath` is not a sandbox.** It does not resolve `..`. The sanitizer removes the segment, and the scope check refuses any path that still holds one.
- **A rename must not orphan a folder.** The map is keyed by id, so a project rename moves the folder rather than creating a second one.
- **A dot-prefixed file is invisible to the `Vault` API.** `.papera-index.json` goes through `app.vault.adapter`. Every note stays on the `Vault` API.

## Testing

- **Unit**: the scope check on paths inside, outside, and at the root boundary; the sanitizer on each forbidden character, a leading dot, a trailing dot, a trailing space, a control character, each reserved device name, an over-long name, an empty result, and a duplicate name; the account file read, write, and its absent and unreadable states; the map built from frontmatter.
- **Manual**: each check below needs a pull first, so all four wait until PO-006 ships.
  - [ ] Rename a project in Papera to `A/B: "C"` and confirm the folder name is safe.
  - [ ] Create two projects with the same name and confirm two folders.
  - [ ] Sign in, pull, reinstall the plugin with `data.json` cleared, and confirm the account record survives.
  - [ ] Delete `.papera-index.json` and confirm the plugin writes it again and keeps working.

## Related

- Related Tickets: PO-003 (whose second-account check reads the account record), PO-006 (the first consumer, and the supplier of the Papera lookup), PO-008 (which adds the attachment map to the file), PO-010 (which depends on the scope check)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
- **Iteration 2 (2026-08-28)**: Interview decisions recorded - the rebuild asks Papera rather than reading a marker, the file stays hidden, a duplicate name takes a short id suffix, and the sanitizer handles four cases beyond the named character set.
- **Iteration 4 (2026-08-29)**: Built. `PaperaVault` owns the vault boundary and runs the scope check first in every method, `paperaFolderName` and `paperaVaultScope` are pure modules under `src/domain/`, `PaperaVaultMap` holds the id-to-path map in memory, and `PaperaVaultIndex` reads and writes the account record. The map build starts inside `Workspace.onLayoutReady` by two paths that race and complete once, and `PaperaVaultMap.ready()` is the accessor PO-010 awaits. Three manual checks and the rename criterion wait for PO-006.
- **Iteration 3 (2026-08-28)**: The persisted index was cut down to the account record. Review found that a corrupt index refused the sign-in while the rebuild that would repair it needed a signed-in session, which locked the person out with no remedy on a phone. Examining what the index held showed five of its six facts were already held by note frontmatter or by Papera. The map moved into memory, and the file kept the one fact nothing else holds.
