# Product Requirements Document

**Status**: Draft
**Last updated**: 2026-08-23
**Product**: Papera for Obsidian — the official plugin that keeps Papera projects and an Obsidian vault in step

**Related specifications**:

- `design.md` — how each surface of the plugin looks and behaves.

---

## 1. Overview

Papera for Obsidian puts a person's Papera projects into their Obsidian vault as folders of
Markdown notes. The notes are ordinary files. The person edits them in Obsidian, and the
plugin sends those edits back to Papera. Papera stays the home of the content, and the vault
becomes a second place to work on it.

Core principles:

- **The vault belongs to the person, not to the plugin.** The plugin manages one folder and leaves every other note alone.
- **A note is the same note in both places.** Its identity survives a rename, a move, and a reinstall.
- **Nothing is lost quietly.** When two edits meet, the person sees both versions.
- **The words stay portable.** A synced note is plain Markdown that reads correctly with the plugin removed.
- **Everywhere the person writes.** The plugin works the same on a desktop and on a phone.

## 2. Problem statement

A person who writes in Papera and also keeps an Obsidian vault has to choose one or copy
between them. Today that costs them:

1. **Copy and paste is the only bridge.** Moving a draft between Papera and a vault is manual, and it happens again on every revision.
2. **A copy goes stale the moment it is made.** Neither side knows the other changed, so the person tracks which version is current in their head.
3. **The vault's strengths do not reach Papera content.** Backlinks, local search, and the person's own note-taking habits stop at the boundary.
4. **Papera content is not available offline.** A person on a plane or a phone with no signal cannot open their own drafts.
5. **Existing sync plugins serve files, not products.** They move bytes between folders, and they know nothing about a project, a title, or a revision.

Papera for Obsidian removes the copying. The person's Papera projects appear as notes they
already know how to work with, and their edits travel back on their own.

## 3. Goals & non-goals

### Goals

- A person connects one Papera account to one vault, and every project they own is available to sync.
- The person chooses which projects sync into the vault, and changes that choice at any time.
- Every synced project appears as one folder of Markdown notes inside a single folder the person names.
- The plugin reads and writes only inside that folder.
- A note carries its Papera identity, so renaming the file changes the title in Papera rather than creating a second note.
- An edit made in the vault reaches Papera without the person asking for it.
- When the same note changed in both places, the person keeps their own text and receives the other version as a second file.
- Losing access to one project leaves every other project syncing.
- Images and files attached to a project are available in the vault, and files added in the vault reach the project.
- Links between Papera notes work as Obsidian links, and Obsidian links written by the person work as Papera links.
- The plugin works on a desktop and on a phone.

### Non-goals (current scope)

- **One vault per project.** An Obsidian plugin installs into a single vault, so one vault holds every project. Splitting projects across vaults would mean one install per project, which the person would have to maintain by hand.
- **Real-time collaboration.** Two people editing one note at the same moment is out of scope today. The product handles a conflict after the fact rather than preventing one.
- **Two Papera accounts in one vault.** A vault holds one account's work. Mixing a personal and a work account in one folder would make every note's ownership ambiguous, and a person who needs both keeps a vault for each.
- **Obsidian Publish integration.** Papera already publishes content. Adding a second publishing path is out of scope today.
- **Syncing a person's own notes into Papera.** The plugin carries Papera content into the vault. Notes the person writes outside the Papera folder stay theirs alone.
- **Editing Papera content the vault cannot represent.** A note is Markdown. Parts of a project that are not writing are visible in Papera, not in the vault.

## 4. Users & personas

| Persona | Need | Primary flow |
| --- | --- | --- |
| The vault-first writer | To draft in the editor they already live in, and to move between related drafts as linked notes | Syncs a project, writes in Obsidian, follows a link from one draft to another, and finds both changes in Papera |
| The Papera-first author | A local copy of their work they can read anywhere | Syncs every project, and reads or fixes a draft offline on a phone |
| The archivist | Confidence that their writing is not held in one place | Syncs everything, and keeps the vault as a plain-text record |
| The bulk editor | To make one change across many drafts at once | Runs a find-and-replace across a synced project and lets every change travel back |

## 5. How the product works

### Signing in `ACCOUNT`

The person signs in to Papera once per vault, through their browser. Papera asks them to
approve the vault, and returns them to Obsidian. One sign-in covers every project the
person owns, so adding a project later needs no new approval.

A vault belongs to one Papera account. The folder records which account its notes came from,
so a person signing in with a second account is told that this vault already holds another
account's work, and is offered the choice to sign in again as the first.

The sign-in stays valid on its own. The person signs in again only if they sign out, or if
they withdraw the vault's access from Papera. Signing out stops the sync and leaves every
synced note in the vault, because the notes are the person's files and losing access to
Papera is not a reason to remove them.

### The Papera folder `SCOPE`

Everything the plugin manages lives inside one folder in the vault. The person names that
folder, and it is called Papera unless they change it. Every other note in the vault is
outside the plugin's reach, and stays exactly as the person left it.

Inside the folder, each synced project is one subfolder, and inside a project each piece of
work is a subfolder of its own holding that work's notes. The person sees the same grouping
in the vault that they see in Papera. A name that a folder cannot hold is adjusted to one
that it can, and two things sharing a name still get two distinct folders. Renaming
something in Papera renames its folder and keeps its notes in place.

The folder also carries the record of which Papera content each file holds. That record
survives removing and reinstalling the plugin, so a person who reinstalls picks up where
they left off rather than syncing everything a second time.

### Bringing projects into the vault `SYNC`

The person picks which of their projects sync. A project they turn on appears as a folder of
Markdown notes. When they turn one off, the plugin checks the folder for edits Papera has not
received. It names those notes and offers to send them before it removes the folder, so
turning a project off never costs the person work.

A sync brings across what changed and leaves the rest alone. A note changed in Papera is
updated in the vault. A note added in Papera appears. A note removed in Papera is removed.
The person sees when the last sync ran, and which projects it covered.

Access to a single project can be withdrawn while the person still holds their account. That
project drops out of the sync on its own, and every other project keeps working.

### Editing in the vault `EDITING`

The person edits a synced note the way they edit any note. A short pause after they stop
typing, the change travels to Papera. Nothing to press, and nothing to remember.

Large changes behave the same as small ones. A find-and-replace touching hundreds of notes
sends every one of them, paced so that Papera receives them in good order. The person sees
how many changes are still on their way.

A Papera note holds headings, paragraphs, lists, quotes, code blocks, tables, images and
links. When a person adds bold, italic or inline code to a synced note, the plugin holds that
note back rather than sending it, and tells them what Papera does not carry. Their text stays
exactly as they wrote it, and they choose whether to keep it or plain it.

Creating a Markdown file inside a project's folder creates that content in Papera. Deleting
a synced note deletes it in Papera too, and the plugin names the note and asks first, because
deleting a file is a light gesture and removing the writing behind it is not.

### Note identity, renames and moves `IDENTITY`

A note's identity travels inside the note itself, in a short block at the top. That block is
what makes a note the same note across a rename, a move, and a reinstall. The file name is a
title, not an identity.

Renaming a synced note therefore retitles it in Papera. Moving a whole piece of work from one
project to another moves it between those projects, because a piece of work belongs to a
project as a unit. A single note belongs to the work it was written for, so the plugin returns
a note dragged out of that group and explains why. Moving a note out of the Papera folder
takes it out of sync and leaves the Papera copy untouched, because the person moved their file
rather than asking for a deletion.

### Links between notes `LINKS`

A link from one Papera note to another arrives in the vault as an Obsidian link, so it opens
in the vault and appears in the backlinks panel. A link the person writes in Obsidian travels
the other way and works in Papera.

A link whose target is not synced keeps working as a link to Papera. A link the person writes
to one of their own notes outside the Papera folder stays their own text, unchanged.

A link holds on to the note it points at, not to the note's title. Retitling a draft leaves
every link to it working, in both places, and changes nothing in the notes that point at it.

### Images and files `ATTACHMENTS`

Each synced project carries its images and files alongside its notes, in a folder of their
own. An image in a Papera draft renders in the vault. An image the person pastes into a
synced note joins that project in Papera. Removing a file in either place removes it in both.

## 6. Cross-cutting qualities

**The vault is safe.** The plugin reads and writes inside its own folder and nowhere else. A
note the person wrote themselves is never read, never changed, and never removed. Removing
the plugin leaves every synced note in place as ordinary Markdown.

**Every edit survives.** When a note changed in Papera and in the vault at the same time, the
person keeps the text they wrote. The other version arrives beside it as a second file, named
so the person can see what it is, and the person decides what to keep.

**The content is faithful.** A note that travels to the vault and back carries the same words,
the same structure, and the same links. What the person reads in Obsidian is what Papera holds.
Where the vault can express something Papera does not carry, the plugin says so and holds the
note rather than quietly changing it.

**The words are portable.** A synced note is plain Markdown in a plain folder. It opens in any
editor, it survives the plugin being removed, and it belongs to the person.

**Everywhere they write.** Every part of the product works on a phone as well as on a desktop.
A person can sync, read, edit, and attach an image from either.

**The account stays protected.** The vault's access to Papera is granted per vault and
withdrawn per vault. It expires and renews on its own, so a vault that leaves the person's
hands does not carry lasting access. Withdrawing access from Papera stops the sync everywhere
it was granted.

## 7. Success metrics

- **Round-trip fidelity** — the share of synced notes whose content is unchanged after travelling to the vault and back — target 100%.
- **Writes outside the folder** — the count of files the plugin reads or writes outside its own folder — target 0.
- **Silent overwrites** — the count of edits lost because one version replaced another without the person seeing it — target 0.
- **Time to first notes** — the median time from signing in to a project's notes appearing in the vault — target under 30 seconds for a project of 100 notes.
- **Edit delivery** — the share of vault edits that reach Papera without the person retrying — target above 99%.
- **Mobile parity** — the share of the product's flows that work on a phone — target 100%.
- **Vault connection rate** — the share of active Papera accounts with a vault connected.
- **Unsync regret** — the share of projects turned off and then turned on again within 7 days — a low figure suggests the person understood what turning one off would do.

## 8. Open questions

- **What happens when a person renames a folder by hand?** A folder in the vault carries the name of a project or of a piece of work. The person can rename it like any other folder. The product must decide whether that renames the thing in Papera, or whether the next sync restores the name.
