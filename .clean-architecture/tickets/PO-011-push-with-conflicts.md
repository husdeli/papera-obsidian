# [PO-011] Push with conflict detection

**Status**: Not Started
**Priority**: High
**Effort**: L
**Category**: feature
**Created**: 2026-08-23

## Description

Send the queued changes to Papera, and handle the case where Papera changed too. This is the
ticket that makes the plugin two-way.

**Warning**: this is where a bug destroys a user's work. The plugin never overwrites a note
and never overwrites a content unit. On a revision mismatch it writes a second file and
leaves both versions intact.

## Acceptance Criteria

- [ ] A queued change pushes the note body to Papera through the PO-009 write endpoint.
- [ ] The push sends the `papera_rev` from the note's frontmatter.
- [ ] A successful push writes the new revision and `updated_at` back into the frontmatter.
- [ ] The frontmatter write does not itself queue another push.
- [ ] A `409` writes `<note> (conflict <date>).md` next to the note, holding the version from Papera.
- [ ] The original note keeps the user's local text, unchanged.
- [ ] A conflict file carries no `papera_id`, so it never syncs and never pushes.
- [ ] The plugin tells the user a conflict happened, and names the note.
- [ ] Links translate from wikilinks to Papera links under the PO-005 rules before the push.
- [ ] A `403` on one note does not stop the queue.
- [ ] A note created by hand under a project folder creates a content unit in Papera, and gains a `papera_id`.
- [ ] A note deleted under a project folder deletes the content unit in Papera.

## Implementation Steps

1. **Push a change**: the queue worker reads the note, translates its links, and calls the write endpoint.
2. **Record the result**: a successful push writes the new revision into the frontmatter and into the index.
3. **Detect a conflict**: a `409` triggers the conflict path.
4. **Write the conflict file**: the plugin fetches the Papera version and writes it to `<note> (conflict <date>).md`, with no `papera_id`.
5. **Report**: the plugin names every conflicted note to the user.
6. **Create**: a new `.md` file under a project folder creates a content unit and gains an id.
7. **Delete**: a deleted note deletes the content unit.

## Decisions

- **The local note always keeps the local text.** The user's own words stay where the user left them. The remote version is the one that arrives as a new file.
- **A conflict file is not synced.** It has no `papera_id`, so nothing pushes it and nothing overwrites it.
- **The frontmatter write-back is a self-write.** It uses the PO-010 marker, or it starts an endless push loop.

## Technical Notes

### Architectural Considerations

- **A delete is not recoverable through this plugin.** Deleting a note deletes the content unit. The design must decide whether the plugin asks first, or relies on Papera's own recovery.
- **A create needs a target project.** The note's folder names it, through the index.

## Testing

- **Unit**: the conflict filename; the frontmatter write-back; the conflict file's missing `papera_id`; the link translation on the push side.
- **API**: the push, the `409`, and the `403`.
- **E2E**: edit one note in Papera and the same note in the vault, push, and confirm both versions survive.
- **Manual**:
  - [ ] Confirm a conflict file never pushes.
  - [ ] Create a note by hand in a project folder and confirm it appears in Papera.

## Related

- Related Tickets: PO-009, PO-010, PO-005, PO-012

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
