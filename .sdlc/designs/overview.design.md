# Papera for Obsidian — design

**Status**: Living document
**Last updated**: 2026-09-08
**Related**: `../prd.md` (product requirements)

<What this doc covers and what it does not. The PRD says what the product does; this doc
says how it presents and behaves.>

---

## 1. Foundations

<Cross-cutting design intent applying to every surface: the character of the palette, the
type hierarchy, spacing, motion, responsiveness, and the shared shell. Qualitative only.>

---

## 2. Links in a synced note

A synced note carries the same links the person's Papera writing carries, spelled the way
Obsidian spells a link. This section specifies both directions. It covers a link from one note
to another, an image, an attachment, and an embed.

The **reserved root folder** is the one folder the plugin syncs into. It is named `Papera`
until the person renames it. A **synced note** is a Markdown file inside that folder that
carries the identity block at the top of the note. A synced note sits three folders deep: a
project folder, a **workflow** folder inside it, and the note inside that. Each project folder
also holds one `attachments/` folder that its workflow folders share.

### 2.1 The address of a content unit

Every rule in this section names the **content unit address** and repeats no address of its
own. The table below is the only place an address appears. It records an assumption, and it
waits on the open question of how Papera addresses a piece of writing. When that question is
answered, this one table changes and no rule changes with it.

| What it addresses | Assumed address |
| --- | --- |
| A content unit | `https://papera.dev/n/<content-unit-id>` |
| A project | `https://papera.dev/p/<project-id>` |
| An attachment | `https://papera.dev/a/<attachment-id>` |

A link is a **Papera link** when two things hold. Its origin is the Papera address the vault is
signed in to. Its path is one the table above recognises. A link that fails either test is an
ordinary link to somewhere else, and no rule in this section touches it.

PO-014 adds this rule. Only an inline Markdown link and an inline Markdown image carry a rule.
An autolink, a bare URL and a reference-style link stay unchanged in both directions. A link
whose address carries a query stays unchanged too, because no wikilink can hold a query. A link
whose display text holds more than plain text stays unchanged as well, because the plugin
cannot move an image or emphasis into a wikilink alias without losing it.

### 2.2 What a Papera link becomes in the vault

A wikilink written into a synced note carries the full path from the vault root, and it carries
the link's display text as its alias. Two notes that share a title in two projects both keep
resolving, whatever a later sync adds.

| The Papera link | What the note holds |
| --- | --- |
| A content unit in the synced set | A wikilink to the note's full path, with the display text as the alias |
| A content unit in another synced project | The same wikilink form, naming that project's folder |
| A content unit outside the synced set | The Markdown link, unchanged |
| A project address | The Markdown link, unchanged |
| An attachment address | A link or an embed inside the project's `attachments/` folder (§2.5) |
| Any other address | The Markdown link, unchanged |

A content unit in another synced project resolves through the same mapping as one in the same
project. The mapping answers with a vault path, and the folder names in that path are what
differ.

A link to the content unit "Kickoff notes", in the project "Acme" and the workflow "Research",
with the display text "Kickoff notes", arrives as:

```
[[Papera/Acme/Research/Kickoff notes|Kickoff notes]]
```

A link that does not become a wikilink stays an ordinary Markdown link, byte for byte, and its
display text is unchanged. It still opens the writing in Papera.

### 2.3 What a vault link becomes in Papera

| The link in the note | What Papera holds |
| --- | --- |
| A wikilink to a synced note | A link to that content unit address, with the alias as its display text |
| A wikilink pointing outside the reserved root folder | The person's text, unchanged |
| A wikilink to a note with no identity block | The person's text, unchanged |
| A wikilink whose target is no file at all | The person's text, unchanged |
| A vault-relative Markdown link to a synced note | A link to that content unit address, with the same display text |
| An ordinary external link | The link, unchanged |

PO-014 adds this rule. A wikilink carrying no alias travels with the title of the content unit
as its display text, and with the note file name when the title is unknown.

Any spelling of a wikilink to a synced note travels to Papera, not only the full-path form of
§2.2. Obsidian respells its own links after a rename, and a person writes a shorter form by
hand. A path that percent-encodes its spaces travels too, and so does a Markdown destination
held inside angle brackets.

In each of the three failure rows the person's text survives exactly as they wrote it. A
wikilink is never dropped, and it is never rewritten into something that resolves elsewhere.

### 2.4 Display text and escaping

A link's display text becomes the wikilink alias in the vault, and the alias becomes the link's
display text in Papera. A Papera link that carries no display text at all arrives with the
title of the content unit as its alias, so the note shows a title rather than a path.

The wikilink target never needs escaping. The plugin removes `|`, `#`, `^`, `[` and `]` from
every project name, workflow name and note name, so no folder name and no note name in the
vault holds one of them.

The display text is what needs a rule:

- A display text holding `|`, `[` or `]` moves the link to the Markdown form, because Obsidian
  has no escape character inside an alias. The note then holds
  `[Kickoff \[draft\]](Papera/Acme/Research/Kickoff%20notes)`, with a backslash before each
  bracket and a space encoded as `%20`. That is the spelling Obsidian writes itself, and §2.3
  translates it back.
- A display text holding `#` or `^` passes through the alias unchanged. Neither character
  carries a meaning inside an alias, so neither needs escaping.
- Inside a Markdown table cell a pipe splits the cell, in the wikilink form and in the Markdown
  form alike. A display text holding a pipe therefore holds `\|` there.

### 2.5 Images and attachments

An image with no alt text arrives as an embed, and an image with alt text arrives as a Markdown
image. No alt text is lost. In an embed the pipe sets a size rather than an alias, so an embed
carries no alt text to lose it in.

```
![[Papera/Acme/attachments/Figure 1.png]]
![The kickoff whiteboard](Papera/Acme/attachments/Figure%201.png)
```

A file that is not an image arrives as a link rather than an embed, and its target keeps the
file extension, because Obsidian resolves a link to a file that is not Markdown only by its
extension: `[[Papera/Acme/attachments/Budget.pdf|Budget]]`.

An image whose file is not in the vault yet stays a Markdown image addressed to Papera. It
renders from Papera, and it becomes an embed or a vault image once the file reaches the
project's `attachments/` folder.

On the way to Papera an embed and a Markdown image that name a file in the project's
`attachments/` folder both become the attachment address. The alt text maps to the display text
under §2.4. An embed of another synced note is different: Papera holds no note inside a note,
so the plugin holds the note back and tells the person, in the same way as a note that carries
emphasis.

### 2.6 Headings and blocks

A heading link is `[[note#Heading]]`, and a block link is `[[note#^block-id]]`.

A heading link travels to Papera as the content unit address with the heading as a URL
fragment. A block link travels as the content unit address alone, without the block identifier,
because the plugin carries no block identifier.

A Papera link that carries a heading fragment arrives as a wikilink holding that heading, as
`[[Papera/Acme/Research/Kickoff notes#Agenda|Kickoff notes]]`. A Papera link that carries no
fragment points at a whole note. No rule writes a block link into a note, because a Papera link
carries no block identifier.

### 2.7 Where the rules do not apply

No rule in this section changes text inside a fenced code block, inside an inline code span, or
inside the identity block at the top of the note. A link written in a code block is a person
showing a link, not following one.

### 2.8 What a round trip loses

A synced note that travels to Papera and back is unchanged, except in the cases below. Each row
names the case and then the loss.

| The case | The loss |
| --- | --- |
| A block link | The block identifier. The link returns pointing at the whole note |
| A Papera link with no display text | Nothing of the text. The link returns carrying the title of the content unit as its display text |
| A wikilink carrying no alias | The short form. The link returns carrying the title of the content unit as its alias |
| A display text holding `\|`, `[` or `]` | The wikilink form. The note holds a Markdown link instead |
| A display text that Markdown reads as markup | The wikilink form. The note holds a Markdown link, and every punctuation character in the display text carries a backslash |
| A character reference in a display text | Its spelling. The display text returns holding the character the reference names |
| A pipe inside a Markdown table cell | The exact characters. The note holds a backslash before the pipe, and Papera holds the pipe alone |
| An embed of a synced note | The embed never reaches Papera. The plugin holds the note back and tells the person |
| An image whose alt text was added or removed | The link form. Adding alt text turns an embed into a Markdown image, and removing it turns the image back into an embed |
| A wikilink written in a shorter form by hand | Its spelling. The link returns as the full path from the vault root |
| A vault-relative Markdown link to a synced note | Its form. The link returns as a wikilink |

---

## 3. <First surface>

<One or two sentences naming the surface and its role.>

### 3.1 Layout

<An ASCII diagram of the regions, with a one-line caption.>

### 3.2 Content

<What each region holds, top to bottom.>

### 3.3 States

| State | Appearance |
| --- | --- |
| Loading | <what the user sees> |
| Empty | <what the user sees> |
| Populated | <what the user sees> |
| Error | <what the user sees> |

### 3.4 Responsive

<What reflows, stacks, collapses, or hides across wide, medium, and small widths.>

---

## N. Other screens (planned)

- <Surface not yet specified.>
