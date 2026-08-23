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
- [ ] An authenticated caller creates a content unit in a project.
- [ ] An authenticated caller deletes a content unit.
- [ ] The endpoint either moves a content unit between two projects, or answers that a move is not supported.
- [ ] The write path uses `markdownToContent`, and no second copy of the conversion rules exists.
- [ ] Block ids survive a read-then-write round trip, or the endpoint documents that they do not.
- [ ] A write to a project the caller may not write gets `403`.
- [ ] The token carries a write scope that is separate from the read scope.

## Implementation Steps

1. **Write scope**: the OAuth token distinguishes read from write, so a Phase 1 install cannot write.
2. **Revision check**: the write compares the caller's revision against the stored one, and answers `409` on a mismatch.
3. **Write**: the endpoint converts the Markdown through `markdownToContent` and stores the result.
4. **Block ids**: the endpoint re-attaches the stored block ids, or it records the loss. Open question 3 in `roadmap.md` decides which.
5. **Title**: a separate endpoint changes the title alone.
6. **Create and delete**: the endpoints add and remove a content unit in a project.
7. **Move**: open question T6 in `roadmap.md` decides whether a content unit can move between projects, given the project → workflow → node chain.

## Decisions

- **The revision check lives on the server.** A client-side check loses a race between two devices.
- **Read scope and write scope are separate.** Phase 1 ships with a read-only token, so a Phase 1 bug cannot damage content.

## Technical Notes

### Data Requirements

- See the shared context in `roadmap.md`, in particular the missing revision column and the block id loss through Markdown.

### Architectural Considerations

- **A move may not be expressible.** A content unit belongs to a node inside a workflow draft inside a project. Moving one across projects may mean moving a node between workflows. If that is not supported, this endpoint says so, and PO-012 returns the file to its folder.

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
