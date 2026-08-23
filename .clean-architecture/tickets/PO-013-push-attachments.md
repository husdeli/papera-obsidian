# [PO-013] Push attachments

**Status**: Not Started
**Priority**: Medium
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Send a file the user adds to a project's `attachments/` folder to Papera, so that an image
pasted into a note in Obsidian appears in the Papera content unit.

## Acceptance Criteria

- [ ] A file added to a project's `attachments/` folder uploads to that project's media in Papera.
- [ ] An image pasted into a synced note lands in that project's `attachments/` folder, not in the vault's default attachment folder.
- [ ] A file deleted from `attachments/` removes the media in Papera.
- [ ] A file renamed in `attachments/` renames the media, and the links in the notes stay correct.
- [ ] An upload that exceeds the per-file ceiling tells the user the file is too large and does not retry.
- [ ] An upload that exceeds the account storage ceiling tells the user which limit was reached.
- [ ] An upload failure does not stop the rest of the push queue.
- [ ] Attachment uploads run through the same queue and the same cap as PO-010.
- [ ] Uploads work on mobile.

## Implementation Steps

1. **Attachment folder setting**: the plugin points Obsidian's attachment location at the project's `attachments/` folder for a synced note.
2. **Upload**: a new file in `attachments/` uploads through Papera's asset upload endpoint.
3. **Delete and rename**: the plugin maps a vault change to the matching media change.
4. **Limits**: the plugin reads the ceiling errors and tells the user plainly.
5. **Queue**: attachment work joins the PO-010 queue, so the cap covers it.

## Decisions

- **Attachments use the same queue as notes.** A pasted folder of images is a burst like any other, and one cap is simpler than two.

## Technical Notes

### Data Requirements

- `project_media` records `size_in_bytes`, and Papera sums it for the per-account storage ceiling. The per-file ceiling is 100 MB.

### Architectural Considerations

- **Obsidian's attachment location is a vault setting.** Redirecting it per note may not be possible for every Obsidian version. If it is not, the plugin moves the pasted file into `attachments/` after the fact and rewrites the link.
- **A large upload on mobile may be slow.** The queue must not block note pushes behind one large file.

## Testing

- **Unit**: the vault change to media change mapping; the ceiling error messages.
- **API**: the upload, the delete, the over-size rejection, and the over-quota rejection.
- **Manual**:
  - [ ] Paste an image into a synced note and confirm it appears in Papera.
  - [ ] Upload a file over 100 MB and confirm the message.
  - [ ] Paste an image on mobile.

## Related

- Related Tickets: PO-008 (the pull half), PO-010, PO-011

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
