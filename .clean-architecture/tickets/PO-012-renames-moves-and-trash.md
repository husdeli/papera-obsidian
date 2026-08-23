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
unit alive in Papera after the user deleted the note. A delete asks for confirmation first, so
this case must reach the delete path in PO-011 rather than being swallowed as a move.

## Acceptance Criteria

- [ ] Renaming a note file changes the content unit title in Papera. It does not delete and recreate the content unit.
- [ ] The renamed note keeps its `papera_id`.
- [ ] Case (a) — a whole workflow folder moves between two project folders: the plugin moves that workflow to the other project in Papera.
- [ ] Case (a2) — a single note moves between two workflow folders: the plugin returns the file to its original folder and tells the user that a note belongs to the work it was written for.
- [ ] Case (b) — a note moves out of the reserved root: the plugin drops it from `.papera-index.json` and deletes nothing in Papera.
- [ ] Case (c) — a note is renamed into `.trash/`: the plugin treats it as a delete, not as case (b).
- [ ] A note moved back into a project folder with its `papera_id` intact is adopted again, and is not created twice.
- [ ] A folder rename by the user inside the reserved root behaves as `prd.md` section 8 decides, under "What happens when a person renames a folder by hand?".
- [ ] Every case above is written into `.clean-architecture/design.md`.

## Implementation Steps

1. **Classify the rename**: one function takes the old path and the new path and answers which case it is.
2. **Title change**: a rename inside the same project folder pushes a title change.
3. **Case (a)**: a workflow folder moved into another project pushes a project move.
4. **Case (a2)**: a note moved into another workflow folder is returned to where it came from, with an explanation.
5. **Case (b)**: a rename out of the reserved root removes the index entry.
6. **Case (c)**: a rename into `.trash/` pushes a delete. The check runs before the case (b) check.
7. **Re-adoption**: a note arriving in a project folder with a `papera_id` matches an existing content unit instead of creating one.
8. **Document**: write the five cases into the design doc.

## Decisions

- **A workflow moves, a note does not.** A workflow belongs to a project as a unit, and moving one is a single column update in Papera. A note belongs to the work it was written for, and moving it between workflows would rewrite Papera's graph.
- **Trash is checked before scope.** `.trash/` sits outside the reserved root, so the case (c) check must run first or case (b) swallows it.
- **A move out of the reserved root never deletes.** The user took the note out of sync. Deleting their content unit for that would be destructive and surprising.

## Technical Notes

### Architectural Considerations

- **Obsidian's trash setting is per vault.** A user may use the system trash instead, which fires a plain `delete`. Both paths must reach the same result.
- **The classifier is one function with one test per case.** These four cases are the ones that destroy content when they are wrong.

## Testing

- **Unit**: the classifier for a same-folder rename, a workflow folder moved between projects, a note moved between workflow folders, a move out of the reserved root, a rename into `.trash/`, and a move back in.
- **E2E**: delete a synced note through Obsidian's trash and confirm Papera deletes the content unit.
- **Manual**:
  - [ ] Move a workflow folder between two projects.
  - [ ] Move a note between two workflow folders and confirm it is returned.
  - [ ] Move a note out of the reserved root and confirm Papera still holds it.
  - [ ] Switch the vault to the system trash and repeat the delete test.

## Related

- Related Tickets: PO-010 (which delivers the rename events), PO-011, PO-009

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket, as item 6 of the feature brief asked.
