# [PO-007] Selective sync settings tab

**Status**: Not Started
**Priority**: High
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Give the user the settings tab that drives the sync: sign in, pick the reserved root folder
name, and choose which Papera projects sync into the vault.

**Warning**: unsyncing a project deletes a folder of the user's notes. The plugin confirms
that no local change is unpushed before it deletes anything.

## Acceptance Criteria

- [ ] The settings tab shows the signed-in account, and offers "Sign in" or "Sign out".
- [ ] The settings tab lists every project the user owns, with a switch per project.
- [ ] Turning a project on pulls it on the next sync.
- [ ] Turning a project off removes its folder from the vault.
- [ ] Before it removes a folder, the plugin checks for local changes that Papera does not have.
- [ ] When an unpushed change exists, the plugin names the affected notes and offers to send them before it removes the folder.
- [ ] Choosing to send waits for every edit to reach Papera, and removes the folder only after they all land.
- [ ] A send that fails leaves the folder in place and reports which notes did not reach Papera.
- [ ] Until the push path exists, the plugin names the affected notes and asks for confirmation instead of offering to send.
- [ ] The reserved root folder name is editable, and changing it moves the existing folder rather than re-pulling.
- [ ] The tab shows when the last sync ran, and what failed.
- [ ] While the plugin has no push, the tab states that a local edit is overwritten on the next sync.
- [ ] The tab renders and works on mobile.

## Implementation Steps

1. **Account section**: sign in, sign out, and the signed-in identity.
2. **Root folder setting**: edit the name, and move the existing folder when it changes.
3. **Project list**: read the project list from the API and render one switch per project.
4. **Unsync check**: compare each note's revision and content against what the index records, and list anything unpushed.
5. **Unsync confirm**: name the affected notes and ask before deleting the folder.
6. **Status**: show the last sync time and the per-project failures from PO-006.

## Decisions

- **Unsync deletes, and always asks first.** Removing a folder is the destructive action in this plugin, so it never runs silently.
- **Unsync offers to send first.** Turning a project off must not cost the person work. The offer needs the push path, so it arrives with PO-011; before then the same check reports the notes and asks for confirmation.
- **A root rename moves, it does not re-pull.** Re-pulling a large vault over a rename wastes the user's time and their bandwidth.

## Technical Notes

### Architectural Considerations

- **In Phase 1 the unpushed check has nothing to push.** It still runs and still reports a locally modified note, because the user loses that edit when the folder goes. The offer to send arrives with PO-011.

## Testing

- **Unit**: the unpushed-change detection; the root folder rename path.
- **E2E**: turn a project off with a locally modified note and confirm the plugin asks first.
- **Manual**:
  - [ ] Change the root folder name and confirm the folder moves and the notes stay.
  - [ ] Open the settings tab on mobile.

## Related

- Related Tickets: PO-006 (the sync it drives), PO-011 (which makes the unpushed check actionable)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
