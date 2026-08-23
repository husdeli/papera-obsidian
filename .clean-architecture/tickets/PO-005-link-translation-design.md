# [PO-005] Link translation design pass

**Status**: Not Started
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

Papera has no internal link format. `LINK_NODE_SCHEMA` is `{ type: "link", text, href }`,
so a link to another content unit is an ordinary URL. Translation is therefore a
URL-matching problem.

## Acceptance Criteria

- [ ] A section of `.clean-architecture/design.md` specifies the translation in both directions.
- [ ] The doc names which `href` values become wikilinks, and which stay ordinary Markdown links.
- [ ] The doc specifies what a link to a content unit outside the synced set becomes.
- [ ] The doc specifies what a link to a content unit in another synced project becomes.
- [ ] The doc specifies what a wikilink pointing outside the reserved root becomes on push.
- [ ] The doc specifies what a wikilink pointing at a note with no `papera_id` becomes on push.
- [ ] The doc specifies how an image and an attachment link translate, and how an embed `![[...]]` translates.
- [ ] The doc specifies how a link's display text maps to the wikilink alias form `[[target|text]]`.
- [ ] The doc specifies the escaping for a title containing `|`, `#`, `^`, `[` or `]`.
- [ ] The doc specifies what happens to a heading link `[[note#heading]]` and a block link `[[note^id]]`.
- [ ] The doc lists every case where the round trip is lossy, and names the loss.

## Implementation Steps

1. **Read the model**: read `LINK_NODE_SCHEMA` and `inlineToMarkdown` in `~/Projects/slide-weaver/src/features/content/domain/`.
2. **Collect the URL forms**: list the Papera URL forms that address a content unit, a project and an asset.
3. **Write the pull rules**: specify Papera link to wikilink.
4. **Write the push rules**: specify wikilink to Papera link.
5. **Write the failure rules**: specify every case where a target does not resolve.
6. **List the losses**: name each case where a round trip changes the note.
7. **Write the section** into `.clean-architecture/design.md`.

## Decisions

- **Design before code**: this is the highest-risk area in the feature, and it rewrites note bodies in both directions.
- **A link that does not resolve is never dropped**: the doc must keep the user's text in every failure case.

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
