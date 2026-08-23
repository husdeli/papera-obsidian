# [PO-008] Pull attachments

**Status**: Not Started
**Priority**: Medium
**Effort**: M
**Category**: feature
**Created**: 2026-08-23

## Description

Pull each project's media into an `attachments/` folder inside that project's folder, so
that an image in a Papera content unit renders in Obsidian.

Papera stores media in `project_media`, keyed by `projects/<ownerId>/<projectId>/<path>`,
and `src/routes/api/projects/assets/$.ts` streams the bytes. That route authenticates by
session cookie today. The plugin has no cookie, so the route must also accept a bearer
token.

## Acceptance Criteria

- [ ] Each synced project folder holds an `attachments/` folder.
- [ ] Every media file the project's synced content units reference is pulled into that folder.
- [ ] The asset route in Papera accepts the plugin's bearer token.
- [ ] An image link in a pulled note resolves to the local attachment and renders in Obsidian.
- [ ] `.papera-index.json` maps each storage key to its vault path.
- [ ] A second pull does not download a file that is already present and unchanged.
- [ ] A media file removed in Papera removes the local attachment.
- [ ] A failed download of one file does not abandon the rest of the pull.
- [ ] Attachments pull on mobile.

## Implementation Steps

1. **Bearer auth on the asset route**: `src/routes/api/projects/assets/$.ts` in `~/Projects/slide-weaver` accepts a bearer token in addition to the session cookie.
2. **Media list**: the API lists the media a project holds. Decide whether this extends PO-001 or adds an endpoint.
3. **Download**: the plugin writes each file into the project's `attachments/` folder through the vault API.
4. **Link rewriting**: an image reference in a pulled note points at the local attachment, under the PO-005 rules.
5. **Change detection**: the index records what was downloaded, so a repeat pull skips it.

## Decisions

- **One `attachments/` folder per project**, not one shared folder. A project unsyncs as a unit, and its media must go with it.

## Technical Notes

### Data Requirements

- `project_media` records `storage_key`, `file_name`, `content_type` and `size_in_bytes`.

### Architectural Considerations

- **The asset route answers `404`, not `403`, for anything the caller may not read.** That is deliberate, so it is not an oracle for which assets exist. The plugin must not read a `404` here as "the file is gone" without checking the media list first.
- **Binary writes go through the vault's binary API**, not through a string write.

## Testing

- **Unit**: the storage key to vault path mapping; the skip-if-unchanged check.
- **API**: the asset route with a bearer token, with a cookie, and with neither.
- **Manual**:
  - [ ] Pull a project with images and confirm they render in Obsidian.
  - [ ] Pull attachments on mobile.

## Related

- Related Tickets: PO-006, PO-013 (the write half)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
