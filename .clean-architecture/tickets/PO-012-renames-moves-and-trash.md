# [PO-012] Renames, moves and trash

**Status**: Not Started
**Priority**: High
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Define and implement what happens when a note moves. A move looks like a delete to a naive
sync, and a wrong reading of one deletes a user's content unit.

`papera_id` in the frontmatter is the identity of a note. Its path is not. Every case below
follows from that.

**Warning**: Obsidian's local trash surfaces a delete as a rename into `.trash/`, which is
outside the reserved root. Read as an ordinary move out of scope, it would leave the content
unit alive in Papera after the user deleted the note.

## Acceptance Criteria

- [ ] Renaming a note file changes the content unit title in Papera. It does not delete and recreate the content unit.
- [ ] The renamed note keeps its `papera_id`.
- [ ] Case (a) — a note moves between two project folders: the plugin moves the content unit to the other project in Papera. If PO-009 does not support a move, the plugin returns the file to its original folder and tells the user why.
- [ ] Case (b) — a note moves out of the reserved root: the plugin drops it from `.papera-index.json` and deletes nothing in Papera.
- [ ] Case (c) — a note is renamed into `.trash/`: the plugin treats it as a delete, not as case (b).
- [ ] A note moved back into a project folder with its `papera_id` intact is adopted again, and is not created twice.
- [ ] A folder rename by the user inside the reserved root behaves as `prd.md` section 8 decides, under "What happens when a person renames a project folder by hand?".
- [ ] Every case above is written into `.clean-architecture/design.md`.

## Implementation Steps

1. **Classify the rename**: one function takes the old path and the new path and answers which case it is.
2. **Title change**: a rename inside the same project folder pushes a title change.
3. **Case (a)**: a rename across two project folders pushes a project move, or reverses the file move.
4. **Case (b)**: a rename out of the reserved root removes the index entry.
5. **Case (c)**: a rename into `.trash/` pushes a delete. The check runs before the case (b) check.
6. **Re-adoption**: a note arriving in a project folder with a `papera_id` matches an existing content unit instead of creating one.
7. **Document**: write the four cases into the design doc.

## Decisions

- **Trash is checked before scope.** `.trash/` sits outside the reserved root, so the case (c) check must run first or case (b) swallows it.
- **A move out of the reserved root never deletes.** The user took the note out of sync. Deleting their content unit for that would be destructive and surprising.

## Technical Notes

### Architectural Considerations

- **Obsidian's trash setting is per vault.** A user may use the system trash instead, which fires a plain `delete`. Both paths must reach the same result.
- **The classifier is one function with one test per case.** These four cases are the ones that destroy content when they are wrong.

## Testing

- **Unit**: the classifier for a same-folder rename, a cross-project move, a move out of the reserved root, a rename into `.trash/`, and a move back in.
- **E2E**: delete a synced note through Obsidian's trash and confirm Papera deletes the content unit.
- **Manual**:
  - [ ] Move a note between two project folders.
  - [ ] Move a note out of the reserved root and confirm Papera still holds it.
  - [ ] Switch the vault to the system trash and repeat the delete test.

## Related

- Related Tickets: PO-010 (which delivers the rename events), PO-011, PO-009

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket, as item 6 of the feature brief asked.
