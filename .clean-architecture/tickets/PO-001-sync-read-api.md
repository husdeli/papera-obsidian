# [PO-001] Sync read API in Papera

**Status**: Not Started
**Priority**: Critical
**Effort**: L
**Category**: feature
**Created**: 2026-08-23
**Repo**: `~/Projects/slide-weaver`

## Description

Papera serves no API that lists a user's projects or returns the words in a content unit.
Every other ticket in this roadmap waits on that API. This ticket builds the read half of
it, authenticated by the OAuth access token the plugin already gets from PO-003.

The layout, the revision source and the block-id behaviour are decided and recorded in the
shared decisions in `roadmap.md`. The endpoints below follow them.

## Acceptance Criteria

- [ ] An authenticated caller lists the projects the caller owns, each with its id, name and last change time.
- [ ] An authenticated caller lists the workflows in one project, each with its id and name.
- [ ] An authenticated caller lists the content units in one workflow, each with its id, title, revision and last change time.
- [ ] An authenticated caller reads one content unit as Markdown, with its revision.
- [ ] An authenticated caller lists the media one project holds, through an endpoint of its own.
- [ ] The Markdown comes from `contentToMarkdown`, and no second copy of the conversion rules exists.
- [ ] Every response carries a revision value that the plugin stores as `papera_rev`.
- [ ] A caller who does not own a project gets `404` for that project alone, matching `src/routes/api/projects/assets/$.ts`.
- [ ] A bearer token issued by `oauthProvider` authenticates every endpoint.
- [ ] The sync API accepts the resource `${AUTH_CONFIG.URL}/api/sync` as the token audience, and requires the `sync:read` scope.
- [ ] A session cookie does not authenticate these endpoints.
- [ ] A list response pages by keyset, and the plugin can read a project of 5,000 content units.
- [ ] A workflow that belongs to no project is left out of every response.

## Implementation Steps

1. **Audience**: `auth.server.ts` sets `validAudiences: [MCP_RESOURCE_URL]`, which scopes every token to `/api/mcp`. Add the audience the sync API accepts, or it rejects every token the plugin holds.
2. **Bearer authentication**: one guard turns an `Authorization: Bearer` header into a user id, using the tokens `oauthProvider` issues.
3. **Project list**: the endpoint returns the caller's projects.
4. **Content unit list**: the endpoint returns one project's content units.
5. **Content unit read**: the endpoint returns one content unit as Markdown plus its revision.
6. **Revision**: `content_units` gains a monotonic revision counter, as the shared decisions record.
7. **Scopes**: the token carries a read scope, so PO-009 can add a separate write scope.

## Decisions

- **Markdown on the wire**: the API serves Markdown, not the block model — `contentToMarkdown` and `markdownToContent` already exist, and the plugin must not hold a second copy of them.
- **Bearer only**: the plugin has no session cookie, and the existing asset route's cookie check does not apply here.

### Settled on 2026-08-23

- **T9 — one resource for the whole sync API.** The resource identifier is
  `${AUTH_CONFIG.URL}/api/sync`. Read and write share one audience and are separated by the
  scopes `sync:read` and `sync:write`. A new Nitro handler serves the metadata at
  `/.well-known/oauth-protected-resource/api/sync`. PO-009 gets its separation without a
  second token in `data.json`. This closes open question T9.
- **A shared workflow does not reach the vault.** `workflow_draft.project_id` is nullable, and
  a null means a workflow the owner reuses across projects. Every sync response leaves those
  rows out. The vault mirrors what Papera's project sidebar shows.
- **A project the caller does not own answers `404`, not `403`.** Papera has no sharing model,
  so `403` would confirm that a guessed project id exists.
  `src/routes/api/projects/assets/$.ts` already answers `404` for the same case. The plugin's
  per-project failure isolation drops the project on either status code.

### Not settled — the Better Auth upgrade

`@better-auth/oauth-provider@1.6.24` does not bind a token's audience to its authorization
grant. Advisory GHSA-p2fr-6hmx-4528 covers 1.4.8 through 1.7.0-beta.4. In that version
`checkResource` compares a requested `resource` against the server-wide `validAudiences` list
only. Any client that completes any grant can mint a token for any listed resource, and
`src/routes/api/mcp.ts` checks no scope.

The hole is open today with one audience. It is not created by this ticket.

Requiring the `sync:read` scope in the sync guard stops a client approved only for MCP from
reaching the sync API, because a scope is bound to the consent grant. It does not stop the
reverse: a client approved for `sync:read` can still request `resource=<MCP_RESOURCE_URL>` and
get an MCP token.

Only the upgrade to `better-auth` and `@better-auth/oauth-provider` 1.7.1 closes both
directions. There `validAudiences` is replaced by a `resources` entity and an
`oauthClientResource` table, so a client can only request a resource it was granted.

**This decision is open, and it belongs to the `slide-weaver` repository.**

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

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket → Blocked on three open questions → Status set to Blocked.
- **Iteration 2 (2026-08-23)**: The three questions were decided — one folder per workflow, a monotonic revision counter, and stored block ids re-attached on write → Status set to Not Started. One question remains, T9, on the token audience, and it is a step inside this ticket rather than a blocker.
- **Iteration 3 (2026-08-23)**: A discovery interview settled T9, the shared-workflow question and the `403`/`404` question. The Better Auth upgrade question stays open. Work stopped before planning, because this ticket is built in `~/Projects/slide-weaver` and Papera application changes are not made from the `papera-obsidian` repository → Status left at Not Started.
