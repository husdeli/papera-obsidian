# Papera for Obsidian — roadmap

**Last updated**: 2026-08-25

Status values: ⬜ **Pending** · 🚧 **In Progress** · ✅ **Completed** · 🚫 **Blocked**

The plugin syncs Papera projects into one reserved root folder in a single Obsidian vault.
Phase 1 ships a read-only pull. Phase 2 adds write-back. A failed write costs the user work
that a failed read does not.

**Every task below is built in this repository.** The **Needs from Papera** column names
what a task waits on from Papera, by the numbers in `sync-requirements.md`. How Papera
meets a need is decided and built with the Papera application, not here.

Nothing is blocked. PO-004 is the first task.

| ID | Task | Status | Depends on | Needs from Papera | Ticket |
| --- | --- | --- | --- | --- | --- |
| PO-002 | Plugin skeleton and mobile-safe HTTP | ✅ **Completed** | — | — | `tickets/PO-002-plugin-skeleton.md` |
| PO-003 | OAuth sign-in and token refresh | ✅ **Completed** | PO-002 | R1–R7 | `tickets/PO-003-oauth-sign-in.md` |
| PO-004 | Reserved root, name safety and the vault index | ✅ **Completed** | PO-002, PO-003 | — | `tickets/PO-004-reserved-root-and-index.md` |
| PO-005 | Link translation design pass | ✅ **Completed** | — | R36–R39 | `tickets/PO-005-link-translation-design.md` |
| PO-014 | Link translation, both directions | ⬜ **Pending** | PO-004, PO-005 | — | `tickets/PO-014-link-translation.md` |
| PO-006 | Pull projects and content units | ⬜ **Pending** | PO-003, PO-004, PO-014 | R8–R24, R46–R52 | `tickets/PO-006-pull-content.md` |
| PO-007 | Selective sync settings tab | ⬜ **Pending** | PO-006 | — | `tickets/PO-007-selective-sync-settings.md` |
| PO-008 | Pull attachments | ⬜ **Pending** | PO-006 | R40–R42 | `tickets/PO-008-pull-attachments.md` |
| PO-010 | Vault change detection and the push queue | ⬜ **Pending** | PO-006 | — | `tickets/PO-010-change-detection-and-queue.md` |
| PO-011 | Push with conflict detection | ⬜ **Pending** | PO-010, PO-014 | R25–R31 | `tickets/PO-011-push-with-conflicts.md` |
| PO-012 | Renames, moves and trash | ⬜ **Pending** | PO-011 | R28, R32–R35 | `tickets/PO-012-renames-moves-and-trash.md` |
| PO-013 | Push attachments | ⬜ **Pending** | PO-008, PO-011 | R43–R45 | `tickets/PO-013-push-attachments.md` |

PO-002 through PO-008 and PO-014 ship Phase 1. PO-010 through PO-013 ship Phase 2.

PO-014 is numbered last and ordered fifth. The table is ordered by dependency, not by
number, so the existing tickets kept their identifiers when it was added. PO-001 and PO-009
were the Papera application's read API and write API. They moved to the Papera application
on 2026-08-25, and their numbers are retired.

---

## Shared decisions

These hold across every ticket. Do not re-open them in a plan. They are decisions about the
plugin. The decisions about the Papera application are recorded with Papera.

- **One vault, one install.** All projects sync into one reserved root folder in one vault. An Obsidian vault is a real folder on disk, and a community plugin installs per vault.
- **Reserved root folder.** The plugin manages only paths under the reserved root. Its name is a setting, default `Papera`.
- **Identity lives in frontmatter.** `papera_id` is the source of truth for a note, not its filename. A filename change is a title change.
- **Conflict, never overwrite.** A stale `papera_rev` produces `<note> (conflict <date>).md`.
- **Mobile from day one.** `requestUrl` for every HTTP call, `isDesktopOnly: false`, no Node `fs` or `net`.
- **Pull first, push second.** Phase 1 ships read-only.
- **Token storage.** The access token lands in `data.json` in plaintext, so the plugin uses a short-lived access token with a refresh token.
- **Per-project failure isolation.** A `403` on one project drops that project's folder from the sync and leaves the rest running.
- **One subfolder per workflow.** A project folder holds one subfolder per workflow, and a workflow folder holds its notes. This mirrors Papera's real structure, and it is what makes a workflow folder movable between projects.
- **Attachments stay at project level.** Papera holds media per project, so a project folder holds one `attachments/` folder that its workflow folders share.
- **A whole workflow moves; a single note does not.** Moving a workflow folder between projects moves the workflow in Papera. Moving one note between workflows is not possible in Papera, so the plugin reverses that move instead.
- **Emphasis is never dropped silently.** Papera's content model holds plain text and links, with no bold, italic or inline code. A note carrying emphasis is held back from the push, and the person is told. Their text is left exactly as they wrote it.
- **A vault delete asks before it deletes in Papera.** Deleting a file is a light gesture and removing a content unit is not, so the plugin names the note and asks first.
- **Unsyncing offers to send first.** When a project holding unsent edits is turned off, the plugin offers to push those edits before it removes the folder.
- **Revision is a counter, not an ETag.** The plugin stores the revision Papera returns as `papera_rev`, and sends it back on a push.
- **The plugin carries no block id.** Markdown holds none, and Papera restores its own on a write.
- **Attachments are listed apart from content.** The plugin reads one listing per project for its media, and a note listing carries no attachment data.
- **One vault, one Papera account.** The reserved root holds one account's projects. The index records which account the folder belongs to, so signing in as a different account is detected and refused rather than mixing two accounts' content in one folder.
- **One token, two scopes.** The plugin sends `resource=<baseUrl>/api/sync` on every token request, and asks for `sync:read` in Phase 1 and `sync:write` in Phase 2. One resource means one token in `data.json`, not two.
- **A shared workflow gets no folder.** A workflow the owner reuses across projects belongs to no project, and the vault mirrors what Papera's project sidebar shows.
- **A project the plugin may not read answers `404` or `403`.** The plugin drops that project from the sync on either code, and keeps every other project running.
- **A folder rename renames in Papera.** Renaming a project folder renames the project, and renaming a workflow folder renames the workflow. The plugin tells the person it reached Papera, because a folder rename in a vault does not usually leave the vault. It does not ask first: a rename is reversible, unlike a delete.

Out of scope for every ticket: multi-vault mapping, one vault per project, real-time
collaboration, and Obsidian Publish integration.

---

## Open questions

Technical decisions about the plugin that are not settled. Each one names the tickets it
blocks. Delete an entry once it is decided, and fold the answer into the ticket. The
questions this plugin has for Papera are in `sync-requirements.md` section 6.

| # | Question | Blocks |
| --- | --- | --- |
| T7 | **Can Obsidian's attachment location be redirected per note?** If it cannot, the plugin moves a pasted file into the project's folder afterwards and rewrites the link. | PO-013 |
| T8 | **Does Obsidian update inbound wikilinks when "Automatically update internal links" is off?** The rename path depends on Obsidian respelling its own links. A person who turned that setting off may see a stale wikilink after a rename in Papera. | PO-006, PO-014 |
| T11 | **What happens when a person changes the reserved root folder name after a sync, or renames the reserved root folder in the vault?** PO-004 reads the setting once at load and moves no folder, so both cases leave the synced work behind under the old name. The work belongs to a later ticket. | No ticket yet |

T1, T2, T3, T6 and T9 are decided and recorded in the shared decisions above. T10 was a
question about the Papera application. It moved there on 2026-08-25, and it blocks no
ticket here.

---

## Product decisions that block tickets

These are product questions, and they live in `prd.md` section 8. They are listed here
because tickets wait on them. The question text stays in the PRD; this table only records
what each one holds up.

No product question is open. Every decision is recorded in `prd.md` and in the shared
decisions above.
