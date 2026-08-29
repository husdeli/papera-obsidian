# What the plugin needs from Papera

**Status**: Draft
**Last updated**: 2026-08-25
**Related**: `prd.md` (what the product does), `roadmap.md` (the plugin's tasks)

---

## 1. What this is

Papera for Obsidian syncs a person's Papera projects into their Obsidian vault. Half of
that work is the plugin, and this repository holds it. The other half is what Papera has to
offer the plugin, and this document lists it.

Each entry is a **need**: something the plugin cannot do its job without. Every need says
what breaks when it is missing.

**This document holds no design.** It names no address, no field, no message and no code. It
does not say how Papera answers a need, or what it changes to get there. Those are Papera's
decisions, made with the Papera application. A need that is met is met, however it is met.

Cite a need by its identifier. `R7` means the seventh row of section 3, and it keeps its
number when the list grows.

## 2. How to read a need

| Column | Meaning |
| --- | --- |
| **Need** | What the plugin must be able to do |
| **Why** | What the person loses when it is missing |

A need is written from the plugin's side. "The plugin can read the writing in a project"
says nothing about how it reads it.

---

## 3. The needs

### Access

| # | Need | Why |
| --- | --- | --- |
| R1 | A person signs in to their Papera account from the vault, through their own browser, and comes back to the vault | A plugin cannot be trusted with a password, and a person will not paste a key |
| R2 | One sign-in covers every project the person owns, including a project they make later | Asking again per project would make adding a project a chore |
| R3 | The sign-in renews itself, without the person doing anything | A sync that stops until someone notices is a sync nobody relies on |
| R4 | Access is granted per vault, and withdrawn per vault | A person who loses a laptop cuts that vault off without signing out everywhere else |
| R5 | Reading and writing are granted separately | The plugin ships reading first. A read-only install must be unable to damage writing, whatever bug it has |
| R6 | The plugin learns which account it is signed in as, and nothing more about the person | A vault holds one account's work. The plugin must catch a second account before it mixes two people's notes in one folder. It has no reason to learn a name or an address |
| R7 | The plugin ships no secret, and none is needed | Anyone can read a plugin's code. A secret inside one is not a secret |

### What the plugin can see

| # | Need | Why |
| --- | --- | --- |
| R8 | The plugin lists the projects the person owns | The person chooses which projects sync, and cannot choose from a list they do not have |
| R9 | The plugin sees a project's contents in the same grouping the person sees in Papera | The vault mirrors Papera. A person must recognise their own folders |
| R10 | The plugin sees only what the person owns | The vault is one person's copy of their own work |
| R11 | Work that Papera does not show inside a project stays invisible to the plugin | A folder that appears in the vault and nowhere in Papera is a folder the person cannot explain |
| R12 | Parts of a project that are not writing stay out | The vault holds Markdown notes. What is not writing has no note to be |

### The writing itself

| # | Need | Why |
| --- | --- | --- |
| R13 | The plugin reads a piece of writing as Markdown | A synced note is an ordinary file. It has to open in any editor, and survive the plugin being removed |
| R14 | Papera produces that Markdown, and Papera reads it back | Two converters drift apart, and what drifts with them is a person's writing |
| R15 | Writing that travels to the vault and back is unchanged | The product promises the same words, the same structure and the same links in both places |
| R16 | The plugin is told what Papera's writing cannot carry | The plugin holds back a note rather than quietly flattening what a person wrote |
| R17 | A person's edit does not disturb the parts of the note they did not touch | An edit to one paragraph that silently re-labels the whole note makes every save look like a rewrite |

### Knowing what changed

| # | Need | Why |
| --- | --- | --- |
| R18 | Each piece of writing carries a marker that changes when its words or title change | Without one, every sync rewrites every note, and Obsidian re-indexes a whole vault for nothing |
| R19 | That marker changes for every writer, including a person typing in Papera | A marker that only the sync moves cannot detect the one conflict that matters |
| R20 | The marker only moves forward, and never repeats | The plugin compares two markers and must be able to say which is older |
| R21 | The plugin learns when a piece of writing last changed | The person is shown when a note last changed |

### Identity

| # | Need | Why |
| --- | --- | --- |
| R22 | Every project, piece of work, note and file has an identifier the plugin can store | A note is the same note in both places, and that is what makes it so |
| R23 | An identifier survives a retitle, a move, and the plugin being removed and installed again | A person who reinstalls picks up where they left off, rather than syncing everything a second time |
| R24 | A title is never an identity | Two notes may share a title, and a person renames a note whenever they like |

### Writing back

| # | Need | Why |
| --- | --- | --- |
| R25 | The plugin sends an edited note back | This is the point of the product |
| R26 | Papera refuses a write built on writing that has since changed, and the plugin can tell that refusal apart from every other | Nothing is lost quietly. The plugin keeps the person's text and puts the other version beside it, and it can only do that if it knows a conflict happened |
| R27 | A refused write returns the version Papera holds | The plugin writes that version into the vault as a second file, and asking twice wastes a round trip on a phone |
| R28 | The plugin retitles a note without sending its body | A person renaming a file has not edited it, and a rename must not be able to lose text |
| R29 | The plugin creates a new piece of writing inside a piece of work | A person makes a Markdown file in a synced folder and expects it in Papera |
| R30 | Writing created that way is complete in Papera, and a person can open and edit it there | A half-made record the person cannot use is worse than none |
| R31 | The plugin deletes a piece of writing | A person deletes a note. The plugin names it and asks first, because deleting a file is a light gesture and removing the writing behind it is not |
| R32 | The plugin renames a project and renames a piece of work | Renaming a folder in a vault is how a person renames a thing |
| R33 | Renaming a project does not move anything that project has published | A folder rename in a vault must not break an address someone else is using |
| R34 | The plugin moves a whole piece of work from one project to another | A person drags a folder between two project folders and means it |
| R35 | Moving a single note out of the work it belongs to is refused, and the plugin can tell | The plugin puts the file back and explains, rather than losing the note's place |

### Links between notes

| # | Need | Why |
| --- | --- | --- |
| R36 | Every piece of writing has one address the plugin recognises on sight | A link from one Papera note to another has to become a link that works in Obsidian |
| R37 | That address identifies the writing, not its title | Retitling a note must leave every link to it working, in both places, and change nothing in the notes that point at it |
| R38 | That address is stable | It sits inside a person's writing. An address that changes corrupts what they wrote |
| R39 | A person who follows that address in a browser arrives at the writing | A link that opens nothing is a broken link, whichever side follows it |

### Images and files

| # | Need | Why |
| --- | --- | --- |
| R40 | The plugin lists the files a project holds, apart from its writing | An image in a Papera note has to be in the vault for the note to render |
| R41 | The plugin fetches a file's contents | The same reason |
| R42 | The plugin can tell that a file it already holds is unchanged, without fetching it | A second sync that downloads every image again is unusable on a phone |
| R43 | The plugin adds a file to a project, renames one, and removes one | An image pasted into a synced note belongs to that project |
| R44 | Renaming a file does not change how notes point at it | A rename that rewrote every note holding that image would be a rewrite of a person's writing |
| R45 | The plugin is told when a file is refused for its size, or because the account is full, and which of the two it was | The person is told plainly what happened, and the plugin does not retry something that will never work |

### Scale, pacing and failure

| # | Need | Why |
| --- | --- | --- |
| R46 | The plugin reads a project of several thousand notes completely | A person with a large project is exactly the person who wants a local copy |
| R47 | A first sync of a project of a hundred notes finishes in well under a minute, on a phone | A person watching an empty folder gives up |
| R48 | Reading a large project does not skip or repeat a note when someone is editing it at the same time | A silently missing note is the worst kind of missing note |
| R49 | When the plugin sends too much at once, Papera says so and says when to try again | A find-and-replace across a project sends hundreds of edits. The plugin paces itself, and it needs the signal to pace against |
| R50 | The plugin can tell these apart: not signed in, not permitted, not there, refused as stale, sending too fast, and Papera itself failing | Each one has a different answer. Guessing means signing a person out over a dropped connection, or deleting a note over a server restart |
| R51 | A failure on one project is not a failure of the sync | Losing access to one project leaves every other project syncing |
| R52 | Asking for something the person does not own tells the plugin nothing about whether it exists | The plugin drops that project and moves on either way, and Papera has no reason to confirm a guess |

### Everywhere the person writes

| # | Need | Why |
| --- | --- | --- |
| R53 | Everything above works over ordinary web requests | The plugin runs on a phone, inside Obsidian, with no operating system of its own to lean on |
| R54 | Nothing requires a background connection that stays open | A phone closes one the moment the person switches app |

---

## 4. What the plugin promises in return

These are limits the plugin holds itself to. They are here so that Papera does not build a
defence against something the plugin will never do.

- The plugin reads and writes one folder in the vault, and touches nothing else.
- The plugin acts only on the person's own account, and only on what that person owns.
- The plugin sends one change at a time for one note, and renews its sign-in once at a time.
- The plugin never sends writing that Papera cannot carry. It holds the note back and tells
  the person.
- The plugin never carries Papera's internal labels for the parts of a note.
- The plugin paces itself, and it backs off when told to.
- The plugin deletes nothing in Papera without naming it to the person first.

## 5. Out of scope

The plugin needs none of these, and asks for none of them:

- Two people editing one note at the same moment.
- Two Papera accounts in one vault.
- Anything about a person beyond which account the vault belongs to.
- Publishing, of any kind.
- Reaching another person's projects.

## 6. Open questions

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | What is the address of a piece of writing, and does it open that writing for a person who follows it? (R36 to R39) | Every link inside a synced note. This is the one to settle first: the plugin's link rules are written against the answer, and changing it later rewrites the body of every synced note |
| Q2 | Can access granted to the vault be used for anything beyond syncing? (R4, R5) | Nothing today. The plugin cannot detect this or work around it, so the answer is recorded rather than acted on |
| Q3 | Does Papera pace the plugin, and how? (R49) | Nothing. The plugin paces itself either way |
