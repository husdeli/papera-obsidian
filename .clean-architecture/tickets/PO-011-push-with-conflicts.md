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
- [ ] Links translate from wikilinks to Papera links through the PO-014 module before the push.
- [ ] A note whose translated body matches what Papera already holds sends nothing.
- [ ] A wikilink respelt by Obsidian after a rename therefore pushes nothing.
- [ ] A `403` on one note does not stop the queue.
- [ ] A note created by hand under a project folder creates a content unit in Papera, and gains a `papera_id`.
- [ ] A note deleted under a project folder deletes the content unit in Papera, after the plugin names the note and the person confirms.
- [ ] Declining the confirmation leaves the content unit in Papera and takes the note out of the index.
- [ ] A note holding bold, italic or inline code is held back from the push, and the plugin tells the person that Papera carries plain text and links.
- [ ] A note held back keeps the person's text exactly as they wrote it, and the plugin never removes the emphasis on their behalf.
- [ ] The plugin offers to remove the emphasis and send, so a held note is not stuck.

## Implementation Steps

1. **Push a change**: the queue worker reads the note, translates its links through the PO-014 module, and calls the write endpoint. This ticket holds no translation logic of its own.
2. **Record the result**: a successful push writes the new revision into the frontmatter and into the index.
3. **Detect a conflict**: a `409` triggers the conflict path.
4. **Write the conflict file**: the plugin fetches the Papera version and writes it to `<note> (conflict <date>).md`, with no `papera_id`.
5. **Report**: the plugin names every conflicted note to the user.
6. **Create**: a new `.md` file under a project folder creates a content unit and gains an id.
7. **Delete**: a deleted note deletes the content unit, after a confirmation naming it.
8. **Emphasis**: the push detects bold, italic and inline code, holds the note, and tells the person. It offers to plain the text and send.

## Decisions

- **The local note always keeps the local text.** The user's own words stay where the user left them. The remote version is the one that arrives as a new file.
- **A conflict file is not synced.** It has no `papera_id`, so nothing pushes it and nothing overwrites it.
- **The frontmatter write-back is a self-write.** It uses the PO-010 marker, or it starts an endless push loop.

## Technical Notes

### Architectural Considerations

- **A delete asks first.** Deleting a file is a light gesture and removing a content unit is not, so the plugin names the note and waits for a yes.
- **Emphasis is held, never stripped silently.** Papera's content model carries plain text and links, with no bold, italic or inline code. Flattening a person's formatting without telling them would break the product's own promise that nothing is lost quietly.
- **A create needs a target project.** The note's folder names it, through the index.

## Testing

- **Unit**: the conflict filename; the frontmatter write-back; the conflict file's missing `papera_id`.
- **API**: the push, the `409`, and the `403`.
- **E2E**: edit one note in Papera and the same note in the vault, push, and confirm both versions survive.
- **Manual**:
  - [ ] Confirm a conflict file never pushes.
  - [ ] Create a note by hand in a project folder and confirm it appears in Papera.

## Related

- Related Tickets: PO-009, PO-010, PO-014, PO-012

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
