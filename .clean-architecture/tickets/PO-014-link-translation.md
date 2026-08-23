# [PO-014] Link translation, both directions

**Status**: Not Started
**Priority**: High
**Effort**: L
**Category**: feature
**Created**: 2026-08-23

## Description

Build the code that turns a Papera link into an Obsidian `[[wikilink]]`, and a wikilink back
into a Papera link. PO-005 writes the rules. This ticket implements them, and owns the tests
that prove they hold.

This is the only part of the plugin that reaches inside a note and rewrites the person's
text. It runs on every pull and every push. Everything else moves whole files.

**Warning**: a wrong rule here corrupts writing rather than failing loudly. The round-trip
tests are the acceptance gate, not an addition to it.

## Acceptance Criteria

- [ ] One module converts a Papera link to a wikilink, and one converts a wikilink to a Papera link.
- [ ] PO-006 and PO-011 call this module and hold no translation logic of their own.
- [ ] A Papera link to a synced content unit becomes a wikilink that resolves in Obsidian.
- [ ] A Papera link to a content unit in another synced project becomes a wikilink that resolves.
- [ ] A Papera link to a content unit that is not synced stays an ordinary Markdown link to Papera.
- [ ] A Papera link to a site outside Papera stays an ordinary Markdown link, unchanged.
- [ ] A link with display text becomes `[[target|text]]`, and returns to the same display text.
- [ ] A wikilink pointing at a note outside the reserved root is left exactly as the person wrote it.
- [ ] A wikilink pointing at a note with no Papera identity is left exactly as the person wrote it.
- [ ] A wikilink whose target does not exist is left exactly as the person wrote it.
- [ ] A target title containing `|`, `#`, `^`, `[` or `]` is escaped, and survives the round trip.
- [ ] A heading link and a block link translate under the PO-005 rules, or stay unchanged when the rules say so.
- [ ] An embed `![[target]]` translates under the PO-005 rules.
- [ ] An image link resolves to the project's local attachment.
- [ ] A round-trip test proves that Papera link to wikilink to Papera link returns the original link.
- [ ] A round-trip test proves that wikilink to Papera link to wikilink returns the original wikilink.
- [ ] Two notes sharing a title in two synced projects each translate to a wikilink that resolves to the right one.
- [ ] Translating a note that holds no link returns the note byte for byte unchanged.
- [ ] Renaming a content unit in Papera changes no link data in any other note.
- [ ] After Obsidian respells an inbound wikilink for a renamed note, that note translates back to the same Papera link as before.

## Implementation Steps

1. **Read the rules**: take the specification PO-005 wrote into `design.md` as the contract. Do not invent a rule that is not there. Send an unlisted case back to PO-005.
2. **Target resolution**: one function answers which Papera content unit a URL addresses, and which vault path holds it, using the index from PO-004.
3. **Papera to wikilink**: convert a link, with its display text, its escaping, and its fallback when the target is not synced.
4. **Wikilink to Papera**: convert a wikilink, with the same three concerns, and the rule that leaves an unresolvable wikilink untouched.
5. **Round-trip tests**: a suite that runs both directions over a corpus and asserts the note returns unchanged.
6. **Corpus**: assemble the note bodies the tests run against, one per case in the PO-005 rules.

## Decisions

- **One module, two directions.** Both directions share the target resolution and the escaping. Two tickets would duplicate that and let the two halves drift.
- **An unresolvable link is never dropped.** In every failure case the person's text survives as they wrote it. A lost link is a visible loss, and a mangled one is worse.
- **Round-trip stability is a hard requirement.** A translation that does not return the original makes a note change on every sync with nobody editing it. Papera then records an endless run of revisions.
- **No rule is invented here.** PO-005 owns the rules. This ticket owns the code and the proof.
- **Links are held by identity, not by title.** A Papera link addresses a content unit by its identity, and that identity does not change when the title changes. Renaming one note therefore changes no data in any other note.
- **Obsidian respells its own wikilinks.** A wikilink must name a path, because Obsidian has no link-by-identity form. When a title changes, the plugin renames the file through Obsidian's file-rename path, and Obsidian updates every inbound wikilink itself. The plugin never rewrites another note to fix a link.
- **A respelt wikilink pushes nothing.** A wikilink that Obsidian respelt translates back to the same Papera link it did before. The push path compares the translated body, finds it unchanged, and sends nothing.

## Technical Notes

### Data Requirements

- The index from PO-004 supplies the mapping between a Papera id, a vault path and a note title. Target resolution reads it and writes nothing.

### Architectural Considerations

- **Resolution is asymmetric.** Obsidian resolves a wikilink by note title across the whole vault, and Papera resolves a link by URL. A title is not unique and a URL is. Two synced notes sharing a title are unambiguous to Papera and ambiguous to Obsidian, so the wikilink must carry enough path to disambiguate.
- **The module is pure.** It takes a note body and the resolution data, and returns a note body. It reads no file and makes no request, which is what makes the round-trip corpus cheap to run.
- **A rename never touches another note's data.** A link is held by identity on the Papera side, so a title change does not change the link. What changes is only how Obsidian spells that link in the vault, and Obsidian is what respells it. See the decision below.

## Testing

- **Unit**: each case in the acceptance criteria, one test per case.
- **Round trip**: the full corpus, both directions, asserting an unchanged note.
- **Property**: a generated corpus of titles containing the reserved characters, asserting round-trip stability.
- **Manual**:
  - [ ] Pull a project whose notes link to each other, and confirm the backlinks panel is populated.
  - [ ] Write a wikilink in Obsidian to one of your own notes outside the reserved root, push, and confirm Papera holds the text unchanged.
  - [ ] Rename a linked note in Papera and confirm the inbound links still resolve.

## Related

- Related Tickets: PO-005 (the rules this implements), PO-004 (the index it resolves against), PO-006 and PO-011 (its callers), PO-008 (attachment links)

---

## Iteration Log

- **Iteration 1 (2026-08-23)**: Split out of PO-006 and PO-011, so the highest-risk code is planned, reviewed and tested on its own rather than as a bullet inside two larger tickets.
