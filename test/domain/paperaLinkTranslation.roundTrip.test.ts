import { describe, expect, it } from 'vitest';
import { paperaFolderName } from '../../src/domain/paperaFolderName';
import { paperaMarkdownSpans } from '../../src/domain/paperaMarkdownSpans';
import { paperaLinkToWikilink } from '../../src/domain/paperaLinkToWikilink';
import { paperaWikilinkToLink } from '../../src/domain/paperaWikilinkToLink';
import type { PaperaTranslation } from '../../src/models/paperaTranslation';
import { type FakeVault, fakeResolverFor } from '../stubs/fakeResolverFor';
import { paperaLinkCorpus } from './paperaLinkCorpus';

const { context, fromPapera, fromVault, paths } = paperaLinkCorpus;

const RESERVED_CHARACTERS = ['|', '#', '^', '[', ']', ' '];

function intoVault(body: string, vault: FakeVault = paperaLinkCorpus.vault): PaperaTranslation {
	return paperaLinkToWikilink.translate(body, context, fakeResolverFor(vault));
}

function intoPapera(body: string, vault: FakeVault = paperaLinkCorpus.vault): PaperaTranslation {
	return paperaWikilinkToLink.translate(body, context, fakeResolverFor(vault));
}

function displayTextIn(body: string): string | undefined {
	const [span] = paperaMarkdownSpans.of(body, 0);

	return span?.kind === 'link' ? span.text : undefined;
}

function generatedTitles(): string[] {
	const titles: string[] = [];

	for (const first of RESERVED_CHARACTERS) {
		for (const second of RESERVED_CHARACTERS) {
			titles.push(`Kickoff${first}notes${second}draft`);
		}
	}

	return titles;
}

describe('the link translation round trip', () => {
	describe('a Papera link to a wikilink and back', () => {
		it.each(fromPapera)('$name', ({ body, returns, rewritten }) => {
			const inVault = intoVault(body).body;

			expect(inVault === body).toBe(rewritten !== true);
			expect(intoPapera(inVault).body).toBe(returns ?? body);
		});
	});

	describe('a wikilink to a Papera link and back', () => {
		it.each(fromVault)('$name', ({ body, returns, rewritten }) => {
			const inPapera = intoPapera(body).body;

			expect(inPapera === body).toBe(rewritten !== true);
			expect(intoVault(inPapera).body).toBe(returns ?? body);
		});
	});

	describe('section 2.8: a pipe inside a Markdown table cell', () => {
		it('holds a backslash before the pipe in the vault, and the pipe alone in Papera', () => {
			const inPapera = '| Note | [One \\| two](https://papera.dev/n/unit-1) |\n';
			const inVault = intoVault(inPapera).body;

			expect(inVault).toBe('| Note | [One \\| two](Papera/Acme/Research/Kickoff%20notes) |\n');
			expect(intoPapera(inVault).body).toBe(inPapera);
		});
	});

	describe('section 2.8: an image whose alt text was added or removed', () => {
		it('writes an embed without alt text and a Markdown image with it', () => {
			expect(intoVault('![](https://papera.dev/a/attachment-1)').body).toBe(
				'![[Papera/Acme/attachments/Figure 1.png]]',
			);
			expect(intoVault('![The whiteboard](https://papera.dev/a/attachment-1)').body).toBe(
				'![The whiteboard](Papera/Acme/attachments/Figure%201.png)',
			);
		});
	});

	describe('section 2.8: an embed of a synced note', () => {
		it('holds the note back and changes no text', () => {
			const body = 'See ![[Papera/Acme/Research/Kickoff notes]] below.';
			const translation = intoPapera(body);

			expect(translation.body).toBe(body);
			expect(translation.heldBack).toEqual(['embeddedSyncedNote']);
		});
	});

	describe('the escaping criterion, target half', () => {
		it('writes a wikilink target that holds none of the five reserved characters', () => {
			const title = paperaFolderName.sanitize('Kickoff | notes # one ^ two [three]');
			const vault: FakeVault = {
				notes: { 'unit-7': { path: `Papera/Acme/Research/${title}.md`, title } },
			};

			expect(title).not.toMatch(/[|#^[\]]/);
			expect(intoVault('[Kickoff](https://papera.dev/n/unit-7)', vault).body).toBe(
				`[[Papera/Acme/Research/${title}|Kickoff]]`,
			);
		});
	});

	describe('the escaping criterion, display-text half', () => {
		it.each(generatedTitles())('returns the display text %s after a round trip', (title) => {
			const body = `See [${title.replace(/[!-/:-@[-`{-~]/g, '\\$&')}](https://papera.dev/n/unit-1) today.`;
			const inVault = intoVault(body).body;
			const returned = intoPapera(inVault).body;

			expect(displayTextIn(body)).toBe(title);
			expect(inVault).toContain('Papera/Acme/Research/Kickoff');
			expect(displayTextIn(returned)).toBe(title);
			expect(intoPapera(intoVault(returned).body).body).toBe(returned);
		});
	});

	describe('a rename', () => {
		const renamed: FakeVault = {
			notes: {
				'unit-1': { path: 'Papera/Acme/Research/The kickoff.md', title: 'The kickoff' },
			},
			targets: {
				'Papera/Acme/Research/The kickoff': 'Papera/Acme/Research/The kickoff.md',
			},
		};

		it('sends the same Papera link after Obsidian respells the inbound wikilink', () => {
			expect(intoPapera('See [[Papera/Acme/Research/Kickoff notes|One]] today.').body).toBe(
				'See [One](https://papera.dev/n/unit-1) today.',
			);
			expect(intoPapera('See [[Papera/Acme/Research/The kickoff|One]] today.', renamed).body).toBe(
				'See [One](https://papera.dev/n/unit-1) today.',
			);
		});

		it('changes no link data in another note when the target is renamed', () => {
			const body = 'See [One](https://papera.dev/n/unit-1) today.';

			expect(intoVault(body, renamed).body).toBe(
				'See [[Papera/Acme/Research/The kickoff|One]] today.',
			);
			expect(intoPapera(intoVault(body, renamed).body, renamed).body).toBe(body);
		});
	});

	describe('two notes sharing a title in two projects', () => {
		it('resolves each wikilink to its own note', () => {
			const inVault = intoVault(
				'[One](https://papera.dev/n/unit-1) and [Two](https://papera.dev/n/unit-2)',
			).body;

			expect(inVault).toBe(
				`[[${paths.KICKOFF.replace('.md', '')}|One]] and [[${paths.BOOK_CLUB_KICKOFF.replace('.md', '')}|Two]]`,
			);
			expect(intoPapera(inVault).body).toBe(
				'[One](https://papera.dev/n/unit-1) and [Two](https://papera.dev/n/unit-2)',
			);
		});
	});
});
