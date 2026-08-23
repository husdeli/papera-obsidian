# Papera for Obsidian — roadmap

**Last updated**: 2026-08-23

Status values: ⬜ **Pending** · 🚧 **In Progress** · ✅ **Completed** · 🚫 **Blocked**

The plugin syncs Papera projects into one reserved root folder in a single Obsidian vault.
Phase 1 ships a read-only pull. Phase 2 adds write-back. A failed write costs the user work
that a failed read does not.

Nothing is blocked. PO-001 is the first task. It and PO-009 are built in the Papera
application, not in this repository, as their **Repo** column says.

| ID | Task | Status | Repo | Depends on | Ticket |
| --- | --- | --- | --- | --- | --- |
| PO-001 | Sync read API in Papera | ⬜ **Pending** | slide-weaver | — | `tickets/PO-001-sync-read-api.md` |
| PO-002 | Plugin skeleton and mobile-safe HTTP | ⬜ **Pending** | this | — | `tickets/PO-002-plugin-skeleton.md` |
| PO-003 | OAuth sign-in and token refresh | ⬜ **Pending** | this | PO-002 | `tickets/PO-003-oauth-sign-in.md` |
| PO-004 | Reserved root, name safety and the vault index | ⬜ **Pending** | this | PO-002 | `tickets/PO-004-reserved-root-and-index.md` |
| PO-005 | Link translation design pass | ⬜ **Pending** | this | PO-001 | `tickets/PO-005-link-translation-design.md` |
| PO-014 | Link translation, both directions | ⬜ **Pending** | this | PO-004, PO-005 | `tickets/PO-014-link-translation.md` |
| PO-006 | Pull projects and content units | ⬜ **Pending** | this | PO-001, PO-003, PO-004, PO-014 | `tickets/PO-006-pull-content.md` |
| PO-007 | Selective sync settings tab | ⬜ **Pending** | this | PO-006 | `tickets/PO-007-selective-sync-settings.md` |
| PO-008 | Pull attachments | ⬜ **Pending** | this | PO-006 | `tickets/PO-008-pull-attachments.md` |
| PO-009 | Sync write API in Papera | ⬜ **Pending** | slide-weaver | PO-001 | `tickets/PO-009-sync-write-api.md` |
| PO-010 | Vault change detection and the push queue | ⬜ **Pending** | this | PO-006 | `tickets/PO-010-change-detection-and-queue.md` |
| PO-011 | Push with conflict detection | ⬜ **Pending** | this | PO-009, PO-010, PO-014 | `tickets/PO-011-push-with-conflicts.md` |
| PO-012 | Renames, moves and trash | ⬜ **Pending** | this | PO-011 | `tickets/PO-012-renames-moves-and-trash.md` |
| PO-013 | Push attachments | ⬜ **Pending** | this | PO-008, PO-011 | `tickets/PO-013-push-attachments.md` |

PO-002 through PO-008 and PO-014 ship Phase 1. PO-009 through PO-013 ship Phase 2.

PO-014 is numbered last and ordered fifth. The table is ordered by dependency, not by
number, so the existing tickets kept their identifiers when it was added.

---

## Shared decisions

These hold across every ticket. Do not re-open them in a plan.

- **One vault, one install.** All projects sync into one reserved root folder in one vault. An Obsidian vault is a real folder on disk, and a community plugin installs per vault.
- **Reserved root folder.** The plugin manages only paths under the reserved root. Its name is a setting, default `Papera`.
- **Identity lives in frontmatter.** `papera_id` is the source of truth for a note, not its filename. A filename change is a title change.
- **Conflict, never overwrite.** A stale `papera_rev` produces `<note> (conflict <date>).md`.
- **Mobile from day one.** `requestUrl` for every HTTP call, `isDesktopOnly: false`, no Node `fs` or `net`.
- **Pull first, push second.** Phase 1 ships read-only.
- **Token storage.** The access token lands in `data.json` in plaintext, so the plugin uses a short-lived access token with a refresh token.
- **Per-project failure isolation.** A `403` on one project drops that project's folder from the sync and leaves the rest running.
- **One subfolder per workflow.** A project folder holds one subfolder per workflow, and a workflow folder holds its notes. This mirrors Papera's real structure, and it is what makes a workflow folder movable between projects.
- **Attachments stay at project level.** `project_media` is keyed by project, so a project folder holds one `attachments/` folder that its workflow folders share.
- **A whole workflow moves; a single note does not.** `workflow_draft.projectId` is a plain column, so moving a workflow folder between projects is a one-column update. Moving one note between workflows would change the composite key `(workflow_id, lifecycle, node_id)` and every edge pointing at it, so the plugin reverses that move instead.
- **Emphasis is never dropped silently.** Papera's content model holds plain text and links, with no bold, italic or inline code. A note carrying emphasis is held back from the push, and the person is told. Their text is left exactly as they wrote it.
- **A vault delete asks before it deletes in Papera.** Deleting a file is a light gesture and removing a content unit is not, so the plugin names the note and asks first.
- **Unsyncing offers to send first.** When a project holding unsent edits is turned off, the plugin offers to push those edits before it removes the folder.
- **Revision is a counter, not an ETag.** `content_units` gains a monotonic revision counter. An ETag over the serialized content would change whenever serialization changes, which would make every note look modified after a Papera deploy.
- **Block ids do not survive Markdown.** `markdownToContent` regenerates them, by its own design. Papera re-attaches the stored ids on write; the plugin never carries them.
- **Media has its own endpoint.** One endpoint lists everything one project holds, which is the single read `project_media` is indexed for. The content listing carries no attachment data.

Out of scope for every ticket: multi-vault mapping, one vault per project, real-time
collaboration, and Obsidian Publish integration.

---

## Shared context — findings from the Papera source

Read from `~/Projects/slide-weaver` on 2026-08-23. Tickets reference this section rather
than repeating it.

- **No read API exists.** `src/routes/api/` serves auth, billing, AI, socials, MCP and project assets. It serves no project list and no content read. The only programmatic content surface is the MCP tool set in `src/mcp/`. PO-001 builds the missing API.
- **A content unit is not a direct child of a project.** The chain is project → workflow draft → node → content unit. `src/features/projects/domain/project-item.schema.ts` says a project holds items of kind `workflow` and `analytics`. `src/db/schema.server.ts` stores a content unit in `content_units` as `{ title, sections }`, keyed by `(workflow_id, lifecycle, node_id)`.
- **`papera_rev` does not exist.** `content_units` carries no revision column. The `nodes` table carries `updated_at`.
- **Markdown conversion already exists, server-side.** `src/features/content/domain/contentToMarkdown.ts` and `markdownToContent.ts` convert both ways. The sync API serves Markdown from these functions, so the plugin holds no second copy of the conversion rules.
- **Markdown loses block ids.** A block carries a stable `id`, and `docs/content-node.md` says renderer back-sync depends on it. Markdown carries no block id.
- **Papera has no internal link format.** `LINK_NODE_SCHEMA` in `src/features/content/domain/content.schema.ts` is `{ type: "link", text, href }`. A link to another content unit is an ordinary `href`.
- **OAuth is already served.** `src/features/auth/auth.server.ts` runs `@better-auth/oauth-provider`. It issues JWT access tokens, stores refresh tokens in `oauth_refresh_token`, and Papera serves `/.well-known/oauth-authorization-server`.
- **Attachments have a home.** `project_media` holds one row per file, keyed by `projects/<ownerId>/<projectId>/<path>`. `src/routes/api/projects/assets/$.ts` streams the bytes and checks the owner against the session. It answers `404`, not `403`, for anything the caller may not read.

---

## Open questions

Technical decisions that are not settled. Each one names the tickets it blocks. Delete an
entry once it is decided, and fold the answer into the ticket.

| # | Question | Blocks |
| --- | --- | --- |
| T7 | **Can Obsidian's attachment location be redirected per note?** If it cannot, the plugin moves a pasted file into the project's folder afterwards and rewrites the link. | PO-013 |
| T8 | **Does Obsidian update inbound wikilinks when "Automatically update internal links" is off?** The rename path depends on Obsidian respelling its own links. A person who turned that setting off may see a stale wikilink after a rename in Papera. | PO-006, PO-014 |
| T9 | **Which token audience does the sync API accept?** `auth.server.ts` sets `validAudiences: [MCP_RESOURCE_URL]`, which scopes every token to `/api/mcp`. The sync API needs its own audience, or it rejects every token the plugin holds. | PO-001, PO-003 |

None of these block PO-001 any more. T1, T2, T3 and T6 are decided and recorded in the
shared decisions above.

---

## Product decisions that block tickets

These are product questions, and they live in `prd.md` section 8. They are listed here
because tickets wait on them. The question text stays in the PRD; this table only records
what each one holds up.

| PRD question | Blocks |
| --- | --- |
| What happens when a person renames a project folder or a workflow folder by hand? | PO-012 |
| Does one vault serve more than one Papera account? | PO-003, PO-004 |
