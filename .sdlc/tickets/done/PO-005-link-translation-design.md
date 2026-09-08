# [PO-005] Link translation design pass

**Status**: Completed
**Priority**: High
**Effort**: M
**Category**: docs
**Created**: 2026-08-23

## Description

Specify how a Papera link becomes an Obsidian `[[wikilink]]`, and how a wikilink becomes a
Papera link. This ticket writes a design doc section. It writes no code.

Link translation runs on every pull and every push, in both directions, and it rewrites the
body of a user's note. A wrong rule corrupts content silently. That is why the rules are
settled before PO-006 writes the first note.

Papera has no internal link format. A link to another content unit is an ordinary URL, so
translation is a URL-matching problem. The canonical URL of a content unit is decided with
Papera, and it is the one answer this ticket waits on.

## Acceptance Criteria

- [x] A section of `.sdlc/designs/overview.design.md` specifies the translation in both directions.
- [x] The doc names which `href` values become wikilinks, and which stay ordinary Markdown links.
- [x] The doc specifies what a link to a content unit outside the synced set becomes.
- [x] The doc specifies what a link to a content unit in another synced project becomes.
- [x] The doc specifies what a wikilink pointing outside the reserved root becomes on push.
- [x] The doc specifies what a wikilink pointing at a note with no `papera_id` becomes on push.
- [x] The doc specifies how an image and an attachment link translate, and how an embed `![[...]]` translates.
- [x] The doc specifies how a link's display text maps to the wikilink alias form `[[target|text]]`.
- [x] The doc specifies the escaping for a title containing `|`, `#`, `^`, `[` or `]`.
- [x] The doc specifies what happens to a heading link `[[note#heading]]` and a block link `[[note^id]]`.
- [x] The doc lists every case where the round trip is lossy, and names the loss.

## Implementation Steps

1. **Read the model**: get the canonical URL of a content unit, and the URL of an image, from the sync API Papera serves.
2. **Collect the URL forms**: list the Papera URL forms that address a content unit, a project and an asset.
3. **Write the pull rules**: specify Papera link to wikilink.
4. **Write the push rules**: specify wikilink to Papera link.
5. **Write the failure rules**: specify every case where a target does not resolve.
6. **List the losses**: name each case where a round trip changes the note.
7. **Write the section** into `.sdlc/designs/overview.design.md`.

## Decisions

- **Design before code**: this is the highest-risk area in the feature, and it rewrites note bodies in both directions.
- **A link that does not resolve is never dropped**: the doc must keep the user's text in every failure case.

### Decisions settled 2026-08-29

- **The assumed Papera address sits in one table**: the section names the address of a
  content unit once, in a table marked as waiting on question Q1. Every other rule names
  the address instead of repeating a URL. When Papera answers Q1, one table changes.
- **A pulled wikilink carries the full path from the vault root**: for example
  `[[Papera/Acme/Research/Kickoff notes|Kickoff notes]]`. Two notes that share a title in
  two projects both keep resolving, whatever a later pull adds.
- **An image arrives in two forms**: an embed `![[...]]` when the image carries no alt
  text, and a Markdown image `![alt](...)` when it carries one. No alt text is lost, and
  the plain case still looks like an ordinary Obsidian embed.
- **The design doc calls the middle folder a workflow**: this matches the roadmap, every
  ticket, and the shared decision "one subfolder per workflow". The PRD keeps the term
  "piece of work" until someone changes it there.

## Technical Notes

### Architectural Considerations

- **The two directions are not symmetric.** Obsidian resolves a wikilink by note title across the whole vault. Papera resolves a link by URL. A title that appears twice in a vault resolves in Obsidian and is ambiguous to Papera.
- **A user may write a wikilink by hand**, pointing at one of their own notes outside the reserved root. The push rules must handle it.

## Testing

- **Manual**:
  - [ ] A reviewer reads the section and can state what happens to a wikilink whose target is not synced.
  - [ ] Every case the section names is buildable as a PO-014 test, with no rule left implicit.
  - [ ] A reviewer can state what a round trip loses.

## Related

- Related Tickets: PO-014 implements what this ticket specifies. PO-006 and PO-011 call it.

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of the original single ticket, as item 10 of the feature brief asked.
- **Iteration 2 (2026-08-25)**: The requirements on the Papera application moved out of this ticket. They are specified with Papera, and this ticket states none of them.
- **Iteration 3 (2026-08-29)**: Section 2 of `design.md` is written. It specifies both
  directions, the assumed content unit address in one table, the display text and escaping
  rules, the image and attachment rules, the heading and block rules, and the loss table. The
  design doc spells a block link `[[note#^block-id]]`, because that is Obsidian's own syntax.
  The acceptance criterion above wrote `[[note^id]]`, which Obsidian does not resolve.
