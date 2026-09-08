import { describe, expect, it } from 'vitest';
import { paperaMarkdownSpans } from '../../src/domain/paperaMarkdownSpans';
import { paperaWikilink } from '../../src/domain/paperaWikilink';

const NOTE = 'Papera/Acme/Research/Kickoff notes.md';
const TARGET = 'Papera/Acme/Research/Kickoff notes';

describe('paperaWikilink', () => {
	describe('writing a link', () => {
		it('writes the full path from the vault root, without the note extension', () => {
			expect(paperaWikilink.write({ target: NOTE, alias: 'Kickoff notes' })).toBe(
				'[[Papera/Acme/Research/Kickoff notes|Kickoff notes]]',
			);
		});

		it('writes no alias when the link carries none', () => {
			expect(paperaWikilink.write({ target: NOTE })).toBe(
				'[[Papera/Acme/Research/Kickoff notes]]',
			);
		});

		it('writes a heading fragment into the wikilink', () => {
			expect(
				paperaWikilink.write({ target: NOTE, alias: 'Kickoff notes', heading: 'Agenda' }),
			).toBe('[[Papera/Acme/Research/Kickoff notes#Agenda|Kickoff notes]]');
		});

		it('writes an embed for a link that carries no display text', () => {
			expect(
				paperaWikilink.write({ target: 'Papera/Acme/attachments/Figure 1.png', embed: true }),
			).toBe('![[Papera/Acme/attachments/Figure 1.png]]');
		});

		it('writes a Markdown image for an embed that carries display text', () => {
			expect(
				paperaWikilink.write({
					target: 'Papera/Acme/attachments/Figure 1.png',
					alias: 'The kickoff whiteboard',
					embed: true,
				}),
			).toBe('![The kickoff whiteboard](Papera/Acme/attachments/Figure%201.png)');
		});

		it('keeps the extension of a file that is not a note', () => {
			expect(
				paperaWikilink.write({
					target: 'Papera/Acme/attachments/Budget.pdf',
					alias: 'Budget',
				}),
			).toBe('[[Papera/Acme/attachments/Budget.pdf|Budget]]');
		});

		it.each([
			['a pipe', 'Kickoff | draft', '[Kickoff \\| draft](Papera/Acme/Research/Kickoff%20notes)'],
			[
				'a bracket pair',
				'Kickoff [draft]',
				'[Kickoff \\[draft\\]](Papera/Acme/Research/Kickoff%20notes)',
			],
		])('moves a display text holding %s to the Markdown form', (_name, alias, written) => {
			expect(paperaWikilink.write({ target: NOTE, alias })).toBe(written);
		});

		it.each([
			['a hash', 'Kickoff #1'],
			['a caret', 'Kickoff ^1'],
		])('passes a display text holding %s through the alias unchanged', (_name, alias) => {
			expect(paperaWikilink.write({ target: NOTE, alias })).toBe(
				`[[Papera/Acme/Research/Kickoff notes|${alias}]]`,
			);
		});

		it.each([
			['emphasis', 'a *b*', '[a \\*b\\*](Papera/Acme/Research/Kickoff%20notes)'],
			['a code span', 'a `b`', '[a \\`b\\`](Papera/Acme/Research/Kickoff%20notes)'],
			['a character reference', 'Q &amp; A', '[Q \\&amp\\; A](Papera/Acme/Research/Kickoff%20notes)'],
		])('moves a display text that Markdown reads as %s to the Markdown form', (_name, alias, written) => {
			expect(paperaWikilink.write({ target: NOTE, alias })).toBe(written);
		});

		it('moves a display text wrapped across two lines to the Markdown form', () => {
			expect(paperaWikilink.write({ target: NOTE, alias: 'Kickoff\nnotes' })).toBe(
				'[Kickoff\nnotes](Papera/Acme/Research/Kickoff%20notes)',
			);
		});

		it('leaves an ampersand a reader would read as an ampersand alone', () => {
			expect(paperaWikilink.write({ target: NOTE, alias: 'Q1 & Q2' })).toBe(
				'[[Papera/Acme/Research/Kickoff notes|Q1 & Q2]]',
			);
		});

		it('writes a heading into the Markdown form as an encoded fragment', () => {
			expect(
				paperaWikilink.write({ target: NOTE, alias: 'Kickoff [draft]', heading: 'Agenda one' }),
			).toBe('[Kickoff \\[draft\\]](Papera/Acme/Research/Kickoff%20notes#Agenda%20one)');
		});

		it('returns a display text holding every reserved character when the note is parsed again', () => {
			const alias = 'One | two # three ^ four [five]';
			const [span] = paperaMarkdownSpans.of(
				paperaWikilink.write({ target: NOTE, alias }),
				0,
			);

			expect(span).toMatchObject({ kind: 'link', text: alias });
		});
	});

	describe('reading a wikilink', () => {
		it.each([
			['a short form', '[[Kickoff notes]]', { embed: false, target: 'Kickoff notes' }],
			['a full path', `[[${TARGET}]]`, { embed: false, target: TARGET }],
			['an embed', '![[Kickoff notes]]', { embed: true, target: 'Kickoff notes' }],
			[
				'a heading fragment',
				'[[Kickoff notes#Agenda]]',
				{ embed: false, target: 'Kickoff notes', heading: 'Agenda' },
			],
			[
				'a block identifier',
				'[[Kickoff notes#^abc123]]',
				{ embed: false, target: 'Kickoff notes', blockId: 'abc123' },
			],
			[
				'an alias',
				'[[Kickoff notes|Kickoff]]',
				{ embed: false, target: 'Kickoff notes', alias: 'Kickoff' },
			],
			[
				'a heading fragment and an alias',
				'[[Kickoff notes#Agenda|Kickoff]]',
				{ embed: false, target: 'Kickoff notes', heading: 'Agenda', alias: 'Kickoff' },
			],
			[
				'an embed of a heading',
				'![[Kickoff notes#Agenda]]',
				{ embed: true, target: 'Kickoff notes', heading: 'Agenda' },
			],
		])('reads %s', (_name, source, parts) => {
			expect(paperaWikilink.read(source)).toMatchObject(parts);
		});

		it('decodes a backslash escape in the alias', () => {
			expect(paperaWikilink.read('[[Kickoff notes|a \\| b]]')?.alias).toBe('a | b');
		});

		it('reads nothing from text that is no wikilink', () => {
			expect(paperaWikilink.read('[Kickoff](https://papera.dev/n/unit-1)')).toBeUndefined();
		});

		it('returns the parts of the wikilink it wrote', () => {
			expect(
				paperaWikilink.read(
					paperaWikilink.write({ target: NOTE, alias: 'Kickoff #1', heading: 'Agenda' }),
				),
			).toEqual({ embed: false, target: TARGET, heading: 'Agenda', alias: 'Kickoff #1' });
		});
	});

	describe('reading a Markdown destination', () => {
		it('percent-decodes the destination before it is compared with a vault path', () => {
			expect(paperaWikilink.readDestination('Papera/Acme/Research/Kickoff%20notes')).toEqual({
				target: TARGET,
			});
		});

		it('reads a heading fragment out of the destination', () => {
			expect(
				paperaWikilink.readDestination('Papera/Acme/Research/Kickoff%20notes#Agenda%20one'),
			).toEqual({ target: TARGET, heading: 'Agenda one' });
		});

		it('keeps a destination that is no valid encoding', () => {
			expect(paperaWikilink.readDestination('Papera/Acme/100% done')).toEqual({
				target: 'Papera/Acme/100% done',
			});
		});
	});

	describe('telling the link forms apart', () => {
		it('recognises an autolink to a Papera address', () => {
			expect(paperaWikilink.isAutolink('<https://papera.dev/n/unit-1>')).toBe(true);
		});

		it.each([
			['an inline link', '[Kickoff](https://papera.dev/n/unit-1)'],
			['an inline image', '![Figure](https://papera.dev/a/attachment-1)'],
		])('does not take %s for an autolink', (_name, source) => {
			expect(paperaWikilink.isAutolink(source)).toBe(false);
		});
	});

	describe('the name of a note', () => {
		it('answers the file name without the note extension', () => {
			expect(paperaWikilink.noteNameOf(NOTE)).toBe('Kickoff notes');
		});

		it('keeps the extension of a file that is not a note', () => {
			expect(paperaWikilink.noteNameOf('Papera/Acme/attachments/Budget.pdf')).toBe(
				'Budget.pdf',
			);
		});
	});
});
