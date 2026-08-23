# [PO-006] Pull projects and content units

**Status**: Not Started
**Priority**: Critical
**Effort**: L
**Category**: feature
**Created**: 2026-08-23

## Description

Write the selected Papera projects into the vault as folders of Markdown notes. This ticket
ships the read-only half of the plugin, which is what Phase 1 delivers. It writes back
nothing.

Each note carries its Papera identity in YAML frontmatter, so the plugin recognises the note
after a rename.

## Acceptance Criteria

- [ ] A "Sync now" command pulls every selected project.
- [ ] Each selected project becomes one folder under the reserved root, named by the PO-004 sanitizer.
- [ ] Each workflow in a project becomes one folder inside its project folder.
- [ ] Each content unit becomes one `.md` file inside its workflow folder.
- [ ] A project folder holds one `attachments/` folder, shared by its workflow folders.
- [ ] Each note carries `papera_id`, `papera_rev` and `updated_at` in YAML frontmatter.
- [ ] The note body is the Markdown the API returns, with links translated by the PO-014 module.
- [ ] A second pull with no change in Papera writes no file.
- [ ] A content unit whose revision changed overwrites the local note, in Phase 1.
- [ ] A content unit deleted in Papera removes the local note.
- [ ] A content unit renamed in Papera renames the local note and keeps its `papera_id`.
- [ ] The pull renames a note through Obsidian's file-rename path, so Obsidian updates every inbound wikilink itself.
- [ ] A rename writes no other note. The plugin never edits a second note to fix a link.
- [ ] A project that answers `403` drops from the sync, and every other project still syncs.
- [ ] A network failure on one content unit does not abandon the rest of the project.
- [ ] The pull reports per-project success and failure to the user.
- [ ] The pull writes no path outside the reserved root.
- [ ] `.papera-index.json` records every id and path the pull wrote.

## Implementation Steps

1. **Read the selection**: the pull reads which projects sync from the settings.
2. **Folders**: the pull creates, renames or keeps one folder per selected project, and one folder per workflow inside it.
3. **Content units**: the pull writes one note per content unit, with frontmatter, and with its links translated by the PO-014 module. This ticket holds no translation logic of its own.
4. **Change detection**: the pull compares the API revision against the revision in the index, and writes only what changed.
5. **Deletions**: a content unit missing from the API removes its note and its index entry.
6. **Failure isolation**: a `403` or a network failure is recorded per project, and the pull continues.
7. **Reporting**: the pull tells the user what synced and what failed.

## Decisions

- **Phase 1 overwrites local edits.** The plugin has no push yet, so a local edit has nowhere to go. The settings tab must say so plainly until PO-011 ships.
- **Revision drives the write.** Comparing revisions avoids rewriting every note on every sync, which would make Obsidian re-index the whole vault.
- **A rename goes through Obsidian, not around it.** Obsidian's file-rename path updates inbound wikilinks on its own. A raw write plus delete would leave every link to the note broken.

## Technical Notes

### Data Requirements

- The frontmatter carries `papera_id`, `papera_rev` and `updated_at`. Nothing else the plugin needs lives in the note.

### Architectural Considerations

- **Writing a file fires a vault event.** PO-010 subscribes to those events. The pull must mark its own writes so that the push queue ignores them.
- **Overwriting on Phase 1 is a stated limitation, not a bug.** It disappears when PO-011 ships conflict detection.

## Testing

- **Unit**: the frontmatter writer and reader; the revision comparison; the deletion path; the per-project failure isolation.
- **API**: the pull against a project list containing one revoked project.
- **E2E**: sign in, pull two projects, and confirm the folder and note contents.
- **Manual**:
  - [ ] Pull a project on mobile.
  - [ ] Rename a content unit in Papera and confirm the note renames and keeps its id.
  - [ ] Revoke one project and confirm the others still sync.

## Related

- Related Tickets: PO-001, PO-003, PO-004, PO-014

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
