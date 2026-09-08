import { describe, expect, it } from 'vitest';
import { paperaLinkToWikilink } from '../../src/domain/paperaLinkToWikilink';
import type { PaperaTranslationContext } from '../../src/models/paperaTranslation';
import { type FakeVault, fakeResolverFor } from '../stubs/fakeResolverFor';

const KICKOFF = 'Papera/Acme/Research/Kickoff notes.md';
const BOOK_CLUB_KICKOFF = 'Papera/Book Club/Drafts/Kickoff notes.md';
const RENAMED = 'Papera/Acme/Research/Kickoff notes (a1b2c3).md';
const FIGURE = 'Papera/Acme/attachments/Figure 1.png';
const BUDGET = 'Papera/Acme/attachments/Budget.pdf';

const VAULT: FakeVault = {
	notes: {
		'unit-1': { path: KICKOFF, title: 'Kickoff notes' },
		'unit-2': { path: BOOK_CLUB_KICKOFF, title: 'Kickoff notes' },
		'unit-3': { path: RENAMED, title: 'Kickoff notes' },
		'unit-4': { path: 'Papera/Acme/Research/Agenda.md' },
	},
	attachments: {
		'attachment-1': FIGURE,
		'attachment-2': BUDGET,
	},
};

const CONTEXT: PaperaTranslationContext = {
	origin: 'https://papera.dev',
	reservedRoot: 'Papera',
	notePath: 'Papera/Acme/Research/Agenda.md',
	bodyStart: 0,
};

function translated(body: string, vault: FakeVault = VAULT): string {
	return paperaLinkToWikilink.translate(body, CONTEXT, fakeResolverFor(vault)).body;
}

describe('paperaLinkToWikilink', () => {
	describe('a link to a content unit', () => {
		it('writes a wikilink that resolves in Obsidian for a synced content unit', () => {
			expect(translated('See [Kickoff notes](https://papera.dev/n/unit-1).')).toBe(
				'See [[Papera/Acme/Research/Kickoff notes|Kickoff notes]].',
			);
		});

		it('names the other project folder for a content unit in another synced project', () => {
			expect(translated('See [Kickoff notes](https://papera.dev/n/unit-2).')).toBe(
				'See [[Papera/Book Club/Drafts/Kickoff notes|Kickoff notes]].',
			);
		});

		it('resolves two notes that share a title in two projects to the right note each', () => {
			expect(
				translated('[One](https://papera.dev/n/unit-1) [Two](https://papera.dev/n/unit-2)'),
			).toBe(
				'[[Papera/Acme/Research/Kickoff notes|One]] [[Papera/Book Club/Drafts/Kickoff notes|Two]]',
			);
		});

		it('keeps the Markdown link of a content unit outside the synced set', () => {
			const body = 'See [Kickoff notes](https://papera.dev/n/unit-9).';

			expect(translated(body)).toBe(body);
		});

		it('keeps a link to a site outside Papera unchanged', () => {
			const body = 'See [the standard](https://commonmark.org/n/unit-1).';

			expect(translated(body)).toBe(body);
		});

		it('keeps a project address unchanged', () => {
			const body = 'See [Acme](https://papera.dev/p/project-1).';

			expect(translated(body)).toBe(body);
		});

		it('keeps an autolink to a Papera address unchanged', () => {
			const body = 'See <https://papera.dev/n/unit-1>.';

			expect(translated(body)).toBe(body);
		});
	});

	describe('the display text', () => {
		it('carries the display text into the alias', () => {
			expect(translated('[The kickoff](https://papera.dev/n/unit-1)')).toBe(
				'[[Papera/Acme/Research/Kickoff notes|The kickoff]]',
			);
		});

		it('carries the title when the link holds no display text', () => {
			expect(translated('[](https://papera.dev/n/unit-3)')).toBe(
				'[[Papera/Acme/Research/Kickoff notes (a1b2c3)|Kickoff notes]]',
			);
		});

		it('carries the note file name when the title is unknown', () => {
			expect(translated('[](https://papera.dev/n/unit-4)')).toBe(
				'[[Papera/Acme/Research/Agenda|Agenda]]',
			);
		});

		it('moves a display text holding a bracket to the Markdown form', () => {
			expect(translated('[Kickoff \\[draft\\]](https://papera.dev/n/unit-1)')).toBe(
				'[Kickoff \\[draft\\]](Papera/Acme/Research/Kickoff%20notes)',
			);
		});
	});

	describe('a display text that is more than plain text', () => {
		it('moves a display text that Markdown reads as emphasis to the Markdown form', () => {
			expect(translated('[a \\*b\\*](https://papera.dev/n/unit-1)')).toBe(
				'[a \\*b\\*](Papera/Acme/Research/Kickoff%20notes)',
			);
		});

		it('moves a display text wrapped across two lines to the Markdown form', () => {
			expect(translated('[Kickoff\nnotes](https://papera.dev/n/unit-1)')).toBe(
				'[Kickoff\nnotes](Papera/Acme/Research/Kickoff%20notes)',
			);
		});

		it('leaves a link whose label holds an image unchanged', () => {
			const body = '[![The figure](https://papera.dev/a/attachment-1)](https://papera.dev/n/unit-1)';

			expect(translated(body)).toBe(body);
		});

		it('leaves an image whose alt text holds emphasis unchanged', () => {
			const body = '![a *b*](https://papera.dev/a/attachment-1)';

			expect(translated(body)).toBe(body);
		});
	});

	describe('a heading fragment', () => {
		it('carries the heading into the wikilink', () => {
			expect(translated('[Kickoff notes](https://papera.dev/n/unit-1#Agenda)')).toBe(
				'[[Papera/Acme/Research/Kickoff notes#Agenda|Kickoff notes]]',
			);
		});
	});

	describe('an attachment', () => {
		it('writes an embed for an image with no alt text', () => {
			expect(translated('![](https://papera.dev/a/attachment-1)')).toBe(
				'![[Papera/Acme/attachments/Figure 1.png]]',
			);
		});

		it('writes a Markdown image for an image with alt text', () => {
			expect(translated('![The kickoff whiteboard](https://papera.dev/a/attachment-1)')).toBe(
				'![The kickoff whiteboard](Papera/Acme/attachments/Figure%201.png)',
			);
		});

		it('writes a wikilink that keeps the extension for a file that is no image', () => {
			expect(translated('[Budget](https://papera.dev/a/attachment-2)')).toBe(
				'[[Papera/Acme/attachments/Budget.pdf|Budget]]',
			);
		});

		it('keeps the Markdown image of an attachment the vault does not hold', () => {
			const body = '![A figure](https://papera.dev/a/attachment-9)';

			expect(translated(body)).toBe(body);
		});
	});

	describe('the rest of the note', () => {
		it('returns a note that holds no link byte for byte', () => {
			const body = '# Agenda\n\nOne line, then another.\n\n- A list item\n';

			expect(translated(body)).toBe(body);
		});

		it('changes no link inside a fenced code block', () => {
			const body = '```\n[Kickoff notes](https://papera.dev/n/unit-1)\n```\n';

			expect(translated(body)).toBe(body);
		});

		it('changes nothing before the body start offset', () => {
			const frontmatter = '---\npapera_id: unit-1\n---\n';
			const body = `${frontmatter}[Kickoff](https://papera.dev/n/unit-1)\n`;

			expect(
				paperaLinkToWikilink.translate(
					body,
					{ ...CONTEXT, bodyStart: frontmatter.length },
					fakeResolverFor(VAULT),
				).body,
			).toBe(`${frontmatter}[[Papera/Acme/Research/Kickoff notes|Kickoff]]\n`);
		});

		it('holds no note back on the way from Papera', () => {
			expect(
				paperaLinkToWikilink.translate(
					'[Kickoff](https://papera.dev/n/unit-1)',
					CONTEXT,
					fakeResolverFor(VAULT),
				).heldBack,
			).toEqual([]);
		});
	});
});
