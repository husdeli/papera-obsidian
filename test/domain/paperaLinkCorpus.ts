import type { PaperaTranslationContext } from '../../src/models/paperaTranslation';
import type { FakeVault } from '../stubs/fakeResolverFor';

export interface PaperaCorpusRow {
	name: string;
	body: string;
	returns?: string;
	rewritten?: boolean;
}

const KICKOFF = 'Papera/Acme/Research/Kickoff notes.md';
const BOOK_CLUB_KICKOFF = 'Papera/Book Club/Drafts/Kickoff notes.md';
const AGENDA = 'Papera/Acme/Research/Agenda.md';
const CELEBRATION = 'Papera/Acme/Research/Kickoff 🎉 notes.md';
const FIGURE = 'Papera/Acme/attachments/Figure 1.png';
const BUDGET = 'Papera/Acme/attachments/Budget.pdf';
const JOURNAL = 'Journal/Monday.md';
const UNCLAIMED = 'Papera/Acme/Research/Scratch.md';

const vault: FakeVault = {
	notes: {
		'unit-1': { path: KICKOFF, title: 'Kickoff notes' },
		'unit-2': { path: BOOK_CLUB_KICKOFF, title: 'Kickoff notes' },
		'unit-4': { path: AGENDA },
		'unit-5': { path: CELEBRATION, title: 'Kickoff 🎉 notes' },
	},
	attachments: {
		'attachment-1': FIGURE,
		'attachment-2': BUDGET,
	},
	targets: {
		'Kickoff notes': KICKOFF,
		'Papera/Acme/Research/Kickoff notes': KICKOFF,
		'Papera/Book Club/Drafts/Kickoff notes': BOOK_CLUB_KICKOFF,
		Agenda: AGENDA,
		'Papera/Acme/Research/Agenda': AGENDA,
		'Kickoff 🎉 notes': CELEBRATION,
		'Papera/Acme/Research/Kickoff 🎉 notes': CELEBRATION,
		[FIGURE]: FIGURE,
		[BUDGET]: BUDGET,
		Monday: JOURNAL,
		'Journal/Monday': JOURNAL,
		Scratch: UNCLAIMED,
	},
};

const context: PaperaTranslationContext = {
	origin: 'https://papera.dev',
	reservedRoot: 'Papera',
	notePath: 'Papera/Acme/Research/Notes.md',
	bodyStart: 0,
};

const fromPapera: PaperaCorpusRow[] = [
	{
		name: 'a content unit in the synced set',
		body: 'See [Kickoff notes](https://papera.dev/n/unit-1) today.',
		rewritten: true,
	},
	{
		name: 'a content unit in another synced project',
		body: 'See [Kickoff notes](https://papera.dev/n/unit-2) today.',
		rewritten: true,
	},
	{
		name: 'a content unit outside the synced set',
		body: 'See [Kickoff notes](https://papera.dev/n/unit-9) today.',
	},
	{ name: 'a project address', body: 'See [Acme](https://papera.dev/p/project-1) today.' },
	{ name: 'an address outside Papera', body: 'See [the standard](https://commonmark.org) today.' },
	{ name: 'an autolink to a Papera address', body: 'See <https://papera.dev/n/unit-1> today.' },
	{
		name: 'a link carrying a heading fragment',
		body: 'See [The kickoff](https://papera.dev/n/unit-1#Agenda) today.',
		rewritten: true,
	},
	{
		name: 'a display text holding a bracket pair',
		body: 'See [Kickoff \\[draft\\]](https://papera.dev/n/unit-1) today.',
		rewritten: true,
	},
	{
		name: 'a display text holding a pipe inside a table row',
		body: '| Note | [One \\| two](https://papera.dev/n/unit-1) |\n',
		rewritten: true,
	},
	{
		name: 'a title holding an emoji',
		body: 'See [Kickoff 🎉 notes](https://papera.dev/n/unit-5) today.',
		rewritten: true,
	},
	{
		name: 'a link inside a fenced code block',
		body: '```\n[Kickoff notes](https://papera.dev/n/unit-1)\n```\n',
	},
	{
		name: 'a reference-style link to a Papera address',
		body: 'See [Kickoff]\n\n[Kickoff]: https://papera.dev/n/unit-1\n',
	},
	{ name: 'a note holding no link', body: '# Agenda\n\nOne line, then another.\n' },
	{
		name: 'a display text whose asterisks are escaped',
		body: 'See [a \\*b\\*](https://papera.dev/n/unit-1) today.',
		rewritten: true,
	},
	{
		name: 'a display text wrapped across two lines',
		body: 'See [Kickoff\nnotes](https://papera.dev/n/unit-1) today.',
		rewritten: true,
	},
	{
		name: 'section 2.8: a character reference in a display text',
		body: 'See [a &amp; b](https://papera.dev/n/unit-1) today.',
		rewritten: true,
		returns: 'See [a & b](https://papera.dev/n/unit-1) today.',
	},
	{
		name: 'a link label holding an image, which carries no rule',
		body: 'See [![The figure](https://papera.dev/a/attachment-1)](https://papera.dev/n/unit-1) today.',
	},
	{
		name: 'an alt text holding emphasis, which carries no rule',
		body: 'See ![a *b*](https://papera.dev/a/attachment-1) today.',
	},
	{
		name: 'an address carrying a query, which no wikilink can hold',
		body: 'See [Kickoff notes](https://papera.dev/n/unit-1?from=inbox) today.',
	},
	{
		name: 'a heading fragment holding a character a URL fragment allows',
		body: 'See [The kickoff](https://papera.dev/n/unit-1#A&B) today.',
		rewritten: true,
	},
	{
		name: 'section 2.8: a Papera link with no display text',
		body: 'See [](https://papera.dev/n/unit-1) today.',
		rewritten: true,
		returns: 'See [Kickoff notes](https://papera.dev/n/unit-1) today.',
	},
];

const fromVault: PaperaCorpusRow[] = [
	{
		name: 'a full-path wikilink carrying an alias',
		body: 'See [[Papera/Acme/Research/Kickoff notes|One]] today.',
		rewritten: true,
	},
	{
		name: 'a wikilink carrying a heading and an alias',
		body: 'See [[Papera/Acme/Research/Kickoff notes#Agenda|One]] today.',
		rewritten: true,
	},
	{
		name: 'a wikilink to a note in another synced project',
		body: 'See [[Papera/Book Club/Drafts/Kickoff notes|One]] today.',
		rewritten: true,
	},
	{ name: 'a wikilink pointing outside the reserved root', body: 'See [[Journal/Monday]] today.' },
	{ name: 'a wikilink to a note with no Papera identity', body: 'See [[Scratch]] today.' },
	{ name: 'a wikilink whose target is no file at all', body: 'See [[Missing note]] today.' },
	{ name: 'an autolink to a Papera address', body: 'See <https://papera.dev/n/unit-1> today.' },
	{ name: 'a wikilink inside a code span', body: 'Write `[[Kickoff notes]]` to link.' },
	{
		name: 'an embed of a synced note',
		body: 'See ![[Papera/Acme/Research/Kickoff notes]] below.',
	},
	{
		name: 'an embed of an attachment, which carries no Papera address until PO-008',
		body: 'See ![[Papera/Acme/attachments/Figure 1.png]] below.',
	},
	{
		name: 'a body that opens with a thematic break',
		body: '---\n\nSee [[Papera/Acme/Research/Kickoff notes|One]] today.\n',
		rewritten: true,
	},
	{
		name: 'a wikilink whose target matches a link-reference definition',
		body: 'See [[Kickoff notes]]\n\n[Kickoff notes]: https://papera.dev/n/unit-1\n',
	},
	{
		name: 'a table row holding a link whose display text escapes a pipe',
		body: '| Note | [One \\| two](Papera/Acme/Research/Kickoff%20notes) |\n',
		rewritten: true,
	},
	{
		name: 'a title holding an emoji',
		body: 'See [[Papera/Acme/Research/Kickoff 🎉 notes|Kickoff 🎉]] today.',
		rewritten: true,
	},
	{ name: 'a note holding no link', body: '# Agenda\n\nOne line, then another.\n' },
	{
		name: 'section 2.8: a wikilink carrying no alias',
		body: 'See [[Papera/Acme/Research/Kickoff notes]] today.',
		rewritten: true,
		returns: 'See [[Papera/Acme/Research/Kickoff notes|Kickoff notes]] today.',
	},
	{
		name: 'section 2.8: a wikilink written in a shorter form by hand',
		body: 'See [[Kickoff notes|One]] today.',
		rewritten: true,
		returns: 'See [[Papera/Acme/Research/Kickoff notes|One]] today.',
	},
	{
		name: 'section 2.8: a block link',
		body: 'See [[Kickoff notes#^abc123|One]] today.',
		rewritten: true,
		returns: 'See [[Papera/Acme/Research/Kickoff notes|One]] today.',
	},
	{
		name: 'section 2.8: a vault-relative Markdown link to a synced note',
		body: 'See [One](Papera/Acme/Research/Kickoff%20notes) today.',
		rewritten: true,
		returns: 'See [[Papera/Acme/Research/Kickoff notes|One]] today.',
	},
	{
		name: 'a Markdown link whose label holds an image, which carries no rule',
		body: 'See [![The figure](Papera/Acme/attachments/Figure%201.png)](Papera/Acme/Research/Kickoff%20notes) today.',
	},
	{
		name: 'section 2.8: an alias holding emphasis',
		body: 'See [[Papera/Acme/Research/Kickoff notes|a *b*]] today.',
		rewritten: true,
		returns: 'See [a \\*b\\*](Papera/Acme/Research/Kickoff%20notes) today.',
	},
	{
		name: 'section 2.8: an alias holding an escaped pipe',
		body: 'See [[Papera/Acme/Research/Kickoff notes|a \\| b]] today.',
		rewritten: true,
		returns: 'See [a \\| b](Papera/Acme/Research/Kickoff%20notes) today.',
	},
	{
		name: 'section 2.8: a wikilink written inside a Markdown link label',
		body: '[see [[Papera/Acme/Research/Kickoff notes]]](Papera/Acme/Research/Kickoff%20notes)',
		rewritten: true,
		returns:
			'[see \\[\\[Papera/Acme/Research/Kickoff notes\\]\\]](Papera/Acme/Research/Kickoff%20notes)',
	},
];

export const paperaLinkCorpus = {
	vault,
	context,
	fromPapera,
	fromVault,
	paths: { KICKOFF, BOOK_CLUB_KICKOFF, AGENDA, CELEBRATION, FIGURE, BUDGET },
};
