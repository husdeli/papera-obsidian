# Papera for Obsidian — roadmap

**Last updated**: 2026-08-23

Status values: ⬜ **Pending** · 🚧 **In Progress** · ✅ **Completed** · 🚫 **Blocked**

The plugin syncs Papera projects into one reserved root folder in a single Obsidian vault.
Phase 1 ships a read-only pull. Phase 2 adds write-back. A failed write costs the user work
that a failed read does not.

Two tasks are built in the Papera application, not in this repository. Their **Repo** column
says so.

| ID | Task | Status | Repo | Depends on | Ticket |
| --- | --- | --- | --- | --- | --- |
| PO-001 | Sync read API in Papera | 🚫 **Blocked** | slide-weaver | Open questions 1–3 | `tickets/PO-001-sync-read-api.md` |
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
| T1 | **What is a "content file" in the vault?** A project holds workflows, and a workflow holds nodes, and a content-unit node holds the words. Does one project folder hold every content unit flat, or one subfolder per workflow? | PO-001, PO-004, PO-006 |
| T2 | **Where does `papera_rev` come from?** Papera adds a revision counter to `content_units`, or the sync API returns an ETag that the plugin stores. | PO-001, PO-009, PO-011 |
| T3 | **Do block ids survive the round trip?** Markdown carries no block id. Either the sync API keeps the ids server-side and re-attaches them on write, or the write path renumbers every block. | PO-001, PO-009 |
| T4 | **Is the plugin a pre-registered OAuth client, or does it register dynamically?** A pre-registered client id ships in the bundle and needs a registry entry in Papera. Dynamic registration needs Papera to support it. | PO-003 |
| T5 | **Does the media list extend the read API, or add its own endpoint?** The plugin needs to know which files a project holds before it can pull them. | PO-008 |
| T6 | **Can a content unit move between projects at all?** A content unit belongs to a node inside a workflow draft inside a project. Moving one across projects may mean moving a node between workflows, which may not be expressible. | PO-009, PO-012 |
| T7 | **Can Obsidian's attachment location be redirected per note?** If it cannot, the plugin moves a pasted file into the project's folder afterwards and rewrites the link. | PO-013 |
| T8 | **Does Obsidian update inbound wikilinks when "Automatically update internal links" is off?** The rename path depends on Obsidian respelling its own links. A person who turned that setting off may see a stale wikilink after a rename in Papera. | PO-006, PO-014 |

T1, T2 and T3 block PO-001, and PO-001 blocks most of the roadmap. The rest block one or
two tickets each and do not hold up anything else.

---

## Product decisions that block tickets

These are product questions, and they live in `prd.md` section 8. They are listed here
because tickets wait on them. The question text stays in the PRD; this table only records
what each one holds up.

| PRD question | Blocks |
| --- | --- |
| How is a project's writing arranged in its folder? | PO-001, PO-004, PO-006 (the product half of T1) |
| What does deleting a note in the vault mean? | PO-011, PO-012 |
| Can writing move between projects? | PO-009, PO-012 (the product half of T6) |
| What happens when a person renames a project folder by hand? | PO-012 |
| What is offered when a person turns off a project holding unsent edits? | PO-007 |
| Does one vault serve more than one Papera account? | PO-003, PO-004 |
