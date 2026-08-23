# [PO-009] Sync write API in Papera

**Status**: Not Started
**Priority**: High
**Effort**: L
**Category**: feature
**Created**: 2026-08-23
**Repo**: `~/Projects/slide-weaver`

## Description

Add the write half of the sync API, so that the plugin can send a local edit back to Papera.
PO-001 built the read half.

**Warning**: this endpoint changes a user's content. It refuses a write whose revision is
stale, so a concurrent edit in the Papera editor is never lost.

## Acceptance Criteria

- [ ] An authenticated caller writes one content unit from Markdown.
- [ ] The write carries the revision the caller last read, and the endpoint rejects a stale one with `409`.
- [ ] A successful write returns the new revision.
- [ ] An authenticated caller renames a content unit title without changing its body.
- [ ] An authenticated caller renames a project.
- [ ] An authenticated caller renames a workflow.
- [ ] An authenticated caller creates a content unit in a project.
- [ ] An authenticated caller deletes a content unit.
- [ ] The endpoint moves a whole workflow between two projects.
- [ ] The endpoint answers that moving a single content unit between workflows is not supported.
- [ ] The write path uses `markdownToContent`, and no second copy of the conversion rules exists.
- [ ] The endpoint re-attaches the stored block ids on write, so a Markdown round trip does not renumber them.
- [ ] A write to a project the caller may not write gets `403`.
- [ ] The token carries a write scope that is separate from the read scope.

## Implementation Steps

1. **Write scope**: the OAuth token distinguishes read from write, so a Phase 1 install cannot write.
2. **Revision check**: the write compares the caller's revision against the stored one, and answers `409` on a mismatch.
3. **Write**: the endpoint converts the Markdown through `markdownToContent` and stores the result.
4. **Block ids**: `markdownToContent` regenerates ids by design, so the endpoint re-attaches the stored ids after conversion. The plugin never carries an id.
5. **Title**: a separate endpoint changes a content unit's title alone.
6. **Names**: separate endpoints rename a project and a workflow.
7. **Create and delete**: the endpoints add and remove a content unit in a workflow.
8. **Move**: a workflow moves between projects by updating `workflow_draft.projectId`, which is a plain column. Moving one content unit between workflows would change the composite key `(workflow_id, lifecycle, node_id)` and every edge pointing at it, so the endpoint refuses it.

## Decisions

- **The revision check lives on the server.** A client-side check loses a race between two devices.
- **Read scope and write scope are separate.** Phase 1 ships with a read-only token, so a Phase 1 bug cannot damage content.

## Technical Notes

### Data Requirements

- See the shared context in `roadmap.md`, in particular the missing revision column and the block id loss through Markdown.

### Architectural Considerations

- **A workflow moves, a note does not.** Moving a workflow between projects is one column update. Moving a note between workflows is graph surgery, so PO-012 returns such a file to its folder instead.

## Testing

- **Unit**: the revision comparison; the Markdown to content conversion for each block type; the block id re-attachment.
- **API**: the write, the `409` on a stale revision, the `403` on a project the caller may not write, the title change, the create, the delete, and the move.
- **Manual**:
  - [ ] Edit a content unit in the Papera editor and in the plugin at the same time, and confirm the `409`.

## Related

- Related Tickets: PO-001 (the read half), PO-011 (the first consumer)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket.
