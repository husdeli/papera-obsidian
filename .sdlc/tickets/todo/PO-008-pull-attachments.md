# [PO-008] Pull attachments

**Status**: Not Started
**Priority**: Medium
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Pull each project's media into an `attachments/` folder inside that project's folder, so
that an image in a Papera content unit renders in Obsidian.

Papera holds media per project, lists it on an endpoint of its own, and streams the bytes
from a second endpoint.

## Acceptance Criteria

- [ ] Each synced project folder holds an `attachments/` folder.
- [ ] Every media file the project's synced content units reference is pulled into that folder.
- [ ] An image link in a pulled note resolves to the local attachment and renders in Obsidian.
- [ ] `.papera-index.json` maps each storage key to its vault path.
- [ ] A second pull does not download a file that is already present and unchanged.
- [ ] A media file removed in Papera removes the local attachment.
- [ ] A failed download of one file does not abandon the rest of the pull.
- [ ] Attachments pull on mobile.

## Implementation Steps

1. **Media list**: the plugin reads the media listing for each synced project.
2. **Download**: the plugin writes each file into the project's `attachments/` folder through the vault API.
3. **Link rewriting**: an image reference in a pulled note points at the local attachment, under the PO-005 rules.
4. **Change detection**: the index records what was downloaded, so a repeat pull skips it.

## Decisions

- **One `attachments/` folder per project**, not one shared folder. A project unsyncs as a unit, and its media must go with it.

## Technical Notes

### Data Requirements

- The media listing gives each file a storage key, a file name, a content type and a size. A storage key is minted once per upload, and the bytes under it never change, so a key the plugin already holds needs no second download.

### Architectural Considerations

- **The download endpoint answers `404` for anything the caller may not read.** That is deliberate, so it is not an oracle for which assets exist. The plugin must not read a `404` here as "the file is gone" without checking the media list first.
- **Binary writes go through the vault's binary API**, not through a string write.

## Testing

- **Unit**: the storage key to vault path mapping; the skip-if-unchanged check.
- **API**: the media listing and one download, each with a valid token and with none.
- **Manual**:
  - [ ] Pull a project with images and confirm they render in Obsidian.
  - [ ] Pull attachments on mobile.

## Related

- Related Tickets: PO-006, PO-013 (the write half)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
- **Iteration 2 (2026-08-25)**: The requirements on the Papera application moved out of this ticket. They are specified with Papera, and this ticket states none of them.
