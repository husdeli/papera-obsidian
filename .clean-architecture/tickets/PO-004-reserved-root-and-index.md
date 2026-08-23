# [PO-004] Reserved root, name safety and the vault index

**Status**: Not Started
**Priority**: Critical
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Build the three pieces every later ticket depends on: the check that keeps the plugin inside
its own folder, the function that turns a Papera project name into a safe folder name, and
the index that maps a Papera id to a vault path.

**Warning**: the scope check protects the user's own notes. Every vault read and every vault
write passes through it. A missing check lets the plugin delete a note it does not own.

## Acceptance Criteria

- [ ] The reserved root folder name is a setting, and it defaults to `Papera`.
- [ ] One function answers whether a vault path is inside the reserved root, and every vault read and write calls it first.
- [ ] A path outside the reserved root is never read and never written.
- [ ] One function turns a project name into a folder name that removes or replaces `/ \ : * ? " < > | # ^ [ ]`.
- [ ] A project name with a leading dot or a trailing space produces a folder name with neither.
- [ ] A project name that sanitizes to an empty string produces a stable fallback name.
- [ ] Two projects whose names sanitize to the same string produce two distinct folders.
- [ ] A project rename in Papera renames the folder, and the folder keeps its identity through the rename.
- [ ] `.papera-index.json` lives under the reserved root and maps every Papera id to its vault path.
- [ ] The index survives a plugin reinstall, and a reinstalled plugin re-adopts the existing folders.
- [ ] The plugin reads the index before it subscribes to any vault event.
- [ ] A corrupt or missing index rebuilds from the `papera_id` values in the note frontmatter.

## Implementation Steps

1. **Setting**: the reserved root folder name reads from `data.json` with the default `Papera`.
2. **Scope check**: one function takes a vault path and answers whether the plugin manages it.
3. **Name safety**: one function sanitizes a project name for the filesystem, for Obsidian and for wikilinks.
4. **Uniqueness**: the sanitizer takes the existing folder names, so a duplicate gets a distinct suffix.
5. **Index**: one module reads, writes and repairs `.papera-index.json`.
6. **Rebuild**: when the index is missing or unreadable, the plugin scans the reserved root and rebuilds from frontmatter.
7. **Startup order**: the plugin loads the index before it subscribes to vault events, so Obsidian's own startup events do not look like user edits.

## Decisions

- **The index is a cache, not the source of truth.** The `papera_id` in a note's frontmatter is authoritative, so a lost index is recoverable.
- **The index lives in the vault, not in `data.json`.** It must survive a plugin reinstall, which clears `data.json`.

## Technical Notes

### Data Requirements

- `.papera-index.json` maps a Papera project id to a folder path, and a Papera content unit id to a file path. It also records the last known revision per content unit.

### Architectural Considerations

- **Wikilink safety goes beyond filesystem safety.** Obsidian reads `|`, `#`, `^`, `[` and `]` inside a `[[wikilink]]`, so a folder name containing one breaks a link that points into it.
- **A rename must not orphan a folder.** The index maps by id, so a project rename moves the folder rather than creating a second one.

## Testing

- **Unit**: the scope check on paths inside, outside, and at the root boundary; the sanitizer on each forbidden character, a leading dot, a trailing space, an empty result, and a duplicate name; the index read, write, and rebuild from frontmatter.
- **Manual**:
  - [ ] Rename a project in Papera to `A/B: "C"` and confirm the folder name is safe.
  - [ ] Create two projects with the same name and confirm two folders.
  - [ ] Delete `.papera-index.json` and confirm the plugin rebuilds it.

## Related

- Related Tickets: PO-006 (the first consumer), PO-010 (which depends on the scope check)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
