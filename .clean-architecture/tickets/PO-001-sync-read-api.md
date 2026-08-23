# [PO-001] Sync read API in Papera

**Status**: Blocked
**Priority**: Critical
**Effort**: L
**Category**: feature
**Created**: 2026-08-23
**Repo**: `~/Projects/slide-weaver`

## Description

Papera serves no API that lists a user's projects or returns the words in a content unit.
Every other ticket in this roadmap waits on that API. This ticket builds the read half of
it, authenticated by the OAuth access token the plugin already gets from PO-003.

The ticket is **Blocked**. The three open questions in `roadmap.md` decide the shape of
every response below.

## Acceptance Criteria

- [ ] An authenticated caller lists the projects the caller owns, each with its id, name and last change time.
- [ ] An authenticated caller lists the content units in one project, each with its id, title, revision and last change time.
- [ ] An authenticated caller reads one content unit as Markdown, with its revision.
- [ ] The Markdown comes from `contentToMarkdown`, and no second copy of the conversion rules exists.
- [ ] Every response carries a revision value that the plugin stores as `papera_rev`.
- [ ] A caller who may not read a project gets `403` for that project alone.
- [ ] A bearer token issued by `oauthProvider` authenticates every endpoint.
- [ ] A session cookie does not authenticate these endpoints.
- [ ] A list response pages, and the plugin can read a project of 5,000 content units.

## Implementation Steps

1. **Decide the shape**: answer open questions 1 to 3 in `roadmap.md`. They decide whether a content unit is addressed by node identity or by a new stable id, and where the revision comes from.
2. **Bearer authentication**: one guard turns an `Authorization: Bearer` header into a user id, using the tokens `oauthProvider` issues.
3. **Project list**: the endpoint returns the caller's projects.
4. **Content unit list**: the endpoint returns one project's content units.
5. **Content unit read**: the endpoint returns one content unit as Markdown plus its revision.
6. **Revision**: `content_units` gains a revision counter, or the endpoint returns an ETag. Open question 2 decides which.
7. **Scopes**: the token carries a read scope, so PO-009 can add a separate write scope.

## Decisions

- **Markdown on the wire**: the API serves Markdown, not the block model — `contentToMarkdown` and `markdownToContent` already exist, and the plugin must not hold a second copy of them.
- **Bearer only**: the plugin has no session cookie, and the existing asset route's cookie check does not apply here.

## Technical Notes

### Data Requirements

- See the shared context in `roadmap.md`. The relevant findings are the missing read API, the project → workflow → node → content unit chain, the missing revision column, and the existing Markdown converters.

### Architectural Considerations

- **Read and write split into two tickets.** This ticket ships read. PO-009 ships write. A read-only token cannot damage a user's content, which is what lets Phase 1 ship early.
- **Paging matters.** A vault sync reads a whole project at once. An unpaged list endpoint fails on a large project.

## Testing

- **Unit**: the bearer guard; the revision value; the Markdown produced for each block type.
- **API**: the project list, the content unit list, the content unit read, the `403` on a project the caller may not read, the `401` on a missing or expired token, and paging.
- **Manual**:
  - [ ] Read a project of 5,000 content units and confirm every page returns.

## Related

- Related Tickets: PO-003 (the token), PO-006 (the first consumer), PO-009 (the write half)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket → Blocked on open questions 1 to 3 → Status set to Blocked.
