import { describe, expect, it } from 'vitest';
import { paperaWikilinkToLink } from '../../src/domain/paperaWikilinkToLink';
import type { PaperaTranslationContext } from '../../src/models/paperaTranslation';
import { type FakeVault, fakeResolverFor } from '../stubs/fakeResolverFor';

const KICKOFF = 'Papera/Acme/Research/Kickoff notes.md';
const BOOK_CLUB_KICKOFF = 'Papera/Book Club/Drafts/Kickoff notes.md';
const AGENDA = 'Papera/Acme/Research/Agenda.md';
const JOURNAL = 'Journal/Monday.md';
const UNCLAIMED = 'Papera/Acme/Research/Scratch.md';

const VAULT: FakeVault = {
	notes: {
		'unit-1': { path: KICKOFF, title: 'Kickoff notes' },
		'unit-2': { path: BOOK_CLUB_KICKOFF, title: 'Kickoff notes' },
		'unit-4': { path: AGENDA },
	},
	targets: {
		'Kickoff notes': KICKOFF,
		'Papera/Acme/Research/Kickoff notes': KICKOFF,
		'Papera/Book Club/Drafts/Kickoff notes': BOOK_CLUB_KICKOFF,
		Agenda: AGENDA,
		'Papera/Acme/Research/Agenda': AGENDA,
		'Monday': JOURNAL,
		'Journal/Monday': JOURNAL,
		Scratch: UNCLAIMED,
	},
};

const CONTEXT: PaperaTranslationContext = {
	origin: 'https://papera.dev',
	reservedRoot: 'Papera',
	notePath: 'Papera/Acme/Research/Notes.md',
	bodyStart: 0,
};

function translate(body: string, vault: FakeVault = VAULT) {
	return paperaWikilinkToLink.translate(body, CONTEXT, fakeResolverFor(vault));
}

describe('paperaWikilinkToLink', () => {
	describe('a wikilink to a synced note', () => {
		it('sends the content unit address with the alias as its display text', () => {
			expect(translate('See [[Papera/Acme/Research/Kickoff notes|The kickoff]].').body).toBe(
				'See [The kickoff](https://papera.dev/n/unit-1).',
			);
		});

		it('sends the title when the wikilink carries no alias', () => {
			expect(translate('See [[Kickoff notes]].').body).toBe(
				'See [Kickoff notes](https://papera.dev/n/unit-1).',
			);
		});

		it('sends the note file name when the title is unknown', () => {
			expect(translate('See [[Agenda]].').body).toBe(
				'See [Agenda](https://papera.dev/n/unit-4).',
			);
		});

		it('sends a note in another synced project', () => {
			expect(translate('See [[Papera/Book Club/Drafts/Kickoff notes]].').body).toBe(
				'See [Kickoff notes](https://papera.dev/n/unit-2).',
			);
		});

		it('escapes a display text holding a pipe', () => {
			expect(translate('[[Kickoff notes|One | two]]').body).toBe(
				'[One \\| two](https://papera.dev/n/unit-1)',
			);
		});

		it('sends the same address for a short form and for a full path', () => {
			expect(translate('[[Kickoff notes|One]] [[Papera/Acme/Research/Kickoff notes|One]]').body).toBe(
				'[One](https://papera.dev/n/unit-1) [One](https://papera.dev/n/unit-1)',
			);
		});
	});

	describe('a link the rules leave alone', () => {
		it.each([
			['a wikilink pointing outside the reserved root', 'See [[Journal/Monday]] today.'],
			['a wikilink to a note with no Papera identity', 'See [[Scratch]] today.'],
			['a wikilink whose target is no file at all', 'See [[Missing note]] today.'],
			['an ordinary external link', 'See [the standard](https://commonmark.org).'],
			['an autolink', 'See <https://papera.dev/n/unit-1> today.'],
			['a link inside a code span', 'Write `[[Kickoff notes]]` to link.'],
			['a link inside a fenced code block', '```\n[[Kickoff notes]]\n```\n'],
			['an image of a vault attachment', '![A figure](Papera/Acme/attachments/Figure%201.png)'],
		])('leaves %s exactly as the person wrote it', (_name, body) => {
			expect(translate(body).body).toBe(body);
		});

		it('returns a note that holds no link byte for byte', () => {
			const body = '# Agenda\n\nOne line, then another.\n\n- A list item\n';

			expect(translate(body).body).toBe(body);
		});
	});

	describe('a heading and a block', () => {
		it('carries a heading fragment to Papera as a URL fragment', () => {
			expect(translate('[[Kickoff notes#Agenda one|The kickoff]]').body).toBe(
				'[The kickoff](https://papera.dev/n/unit-1#Agenda%20one)',
			);
		});

		it('drops a block identifier', () => {
			expect(translate('[[Kickoff notes#^abc123|The kickoff]]').body).toBe(
				'[The kickoff](https://papera.dev/n/unit-1)',
			);
		});
	});

	describe('a vault-relative Markdown link', () => {
		it('sends the content unit address with the same display text', () => {
			expect(translate('[The kickoff](Papera/Acme/Research/Kickoff%20notes)').body).toBe(
				'[The kickoff](https://papera.dev/n/unit-1)',
			);
		});

		it('takes the display text from the decoded value', () => {
			expect(
				translate('[Kickoff \\[draft\\]](Papera/Acme/Research/Kickoff%20notes)').body,
			).toBe('[Kickoff \\[draft\\]](https://papera.dev/n/unit-1)');
		});
	});

	describe('a display text that is more than plain text', () => {
		it('sends a wikilink whose alias holds emphasis', () => {
			expect(translate('See [[Kickoff notes|a *b*]] today.').body).toBe(
				'See [a \\*b\\*](https://papera.dev/n/unit-1) today.',
			);
		});

		it('escapes a decoded pipe once', () => {
			expect(translate('[[Kickoff notes|a \\| b]]').body).toBe(
				'[a \\| b](https://papera.dev/n/unit-1)',
			);
		});

		it('leaves a Markdown link whose label holds an image unchanged', () => {
			const body = '[![The figure](Papera/Acme/attachments/Figure%201.png)](Papera/Acme/Research/Kickoff%20notes)';

			expect(translate(body).body).toBe(body);
		});
	});

	describe('an embed of a synced note', () => {
		it('reports the reason and changes no text', () => {
			const body = 'See ![[Kickoff notes]] below.';
			const translation = translate(body);

			expect(translation.body).toBe(body);
			expect(translation.heldBack).toEqual(['embeddedSyncedNote']);
		});

		it('reports the reason once for two embeds', () => {
			expect(translate('![[Kickoff notes]] and ![[Agenda]]').heldBack).toEqual([
				'embeddedSyncedNote',
			]);
		});

		it('holds no note back for an embed of a note outside the reserved root', () => {
			expect(translate('![[Journal/Monday]]').heldBack).toEqual([]);
		});
	});

	describe('the body start offset', () => {
		it('changes nothing before the note text starts', () => {
			const frontmatter = '---\npapera_id: unit-9\n---\n';
			const body = `${frontmatter}See [[Kickoff notes]].\n`;

			expect(
				paperaWikilinkToLink.translate(
					body,
					{ ...CONTEXT, bodyStart: frontmatter.length },
					fakeResolverFor(VAULT),
				).body,
			).toBe(`${frontmatter}See [Kickoff notes](https://papera.dev/n/unit-1).\n`);
		});
	});
});
