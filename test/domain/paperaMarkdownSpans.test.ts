import { describe, expect, it } from 'vitest';
import { paperaMarkdownSpans } from '../../src/domain/paperaMarkdownSpans';

const BODY_START = 0;

function kindsOf(body: string): string[] {
	return paperaMarkdownSpans.of(body, BODY_START).map((span) => span.kind);
}

describe('paperaMarkdownSpans', () => {
	describe('what carries a rule', () => {
		it('reports an inline link with its destination and its display text', () => {
			const body = 'See [Kickoff notes](https://papera.dev/n/unit-1) today.';

			expect(paperaMarkdownSpans.of(body, BODY_START)).toEqual([
				{
					kind: 'link',
					start: 4,
					end: 48,
					source: '[Kickoff notes](https://papera.dev/n/unit-1)',
					url: 'https://papera.dev/n/unit-1',
					text: 'Kickoff notes',
				},
			]);
		});

		it('reports an inline image with its alt text', () => {
			const body = '![The whiteboard](https://papera.dev/a/attachment-1)';

			expect(paperaMarkdownSpans.of(body, BODY_START)).toEqual([
				{
					kind: 'image',
					start: 0,
					end: body.length,
					source: body,
					url: 'https://papera.dev/a/attachment-1',
					text: 'The whiteboard',
				},
			]);
		});

		it('reports a wikilink and an embed found in plain text', () => {
			expect(kindsOf('[[Kickoff notes]] and ![[Figure 1.png]]')).toEqual([
				'wikilink',
				'wikilink',
			]);
		});

		it('reports the decoded destination and display text of an escaped link', () => {
			const [span] = paperaMarkdownSpans.of(
				'[Kickoff \\[draft\\]](Papera/Acme/Research/Kickoff%20notes)',
				BODY_START,
			);

			expect(span).toMatchObject({
				url: 'Papera/Acme/Research/Kickoff%20notes',
				text: 'Kickoff [draft]',
			});
		});

		it('reports an autolink with its angle brackets in the source', () => {
			const [span] = paperaMarkdownSpans.of('<https://papera.dev/n/unit-1>', BODY_START);

			expect(span?.source.startsWith('<')).toBe(true);
		});
	});

	describe('a display text that is more than plain text', () => {
		it('reports no text for a link label holding an image', () => {
			const [span] = paperaMarkdownSpans.of(
				'[![alt](Fig.png)](https://papera.dev/n/unit-1)',
				BODY_START,
			);

			expect(span).toMatchObject({ kind: 'link' });
			expect(span?.kind === 'link' && span.text).toBeUndefined();
		});

		it('reports no text for a link label holding emphasis', () => {
			const [span] = paperaMarkdownSpans.of('[a *b*](https://papera.dev/n/unit-1)', BODY_START);

			expect(span?.kind === 'link' && span.text).toBeUndefined();
		});

		it('reports no text for an alt text holding emphasis', () => {
			const [span] = paperaMarkdownSpans.of(
				'![a *b*](https://papera.dev/a/attachment-1)',
				BODY_START,
			);

			expect(span).toMatchObject({ kind: 'image' });
			expect(span?.kind === 'image' && span.text).toBeUndefined();
		});

		it('reports the alt text of an image whose alt text is plain', () => {
			const [span] = paperaMarkdownSpans.of(
				'![The whiteboard](https://papera.dev/a/attachment-1)',
				BODY_START,
			);

			expect(span).toMatchObject({ text: 'The whiteboard' });
		});
	});

	describe('a wikilink whose alias holds inline markup', () => {
		it.each([
			['emphasis', 'See [[Papera/Acme/Research/Kickoff notes|a *b*]] today.', '[[Papera/Acme/Research/Kickoff notes|a *b*]]'],
			['an underscore run', 'See [[Kickoff notes|a _b_ c]] today.', '[[Kickoff notes|a _b_ c]]'],
		])('reports one span for a wikilink whose alias holds %s', (_name, body, source) => {
			expect(paperaMarkdownSpans.of(body, BODY_START)).toEqual([
				{
					kind: 'wikilink',
					start: body.indexOf(source),
					end: body.indexOf(source) + source.length,
					source,
				},
			]);
		});

		it.each([
			['a code span', 'See [[Kickoff notes|a `b` c]] today.'],
			['a raw HTML tag', 'See [[Kickoff notes|a <b>c</b>]] today.'],
		])('reports no span for a wikilink whose alias holds %s, which carries no rule', (_name, body) => {
			expect(paperaMarkdownSpans.of(body, BODY_START)).toEqual([]);
		});
	});

	describe('text that Markdown reads as written', () => {
		it.each([
			['plain words', 'Kickoff notes'],
			['a hash and a caret', 'Kickoff #1 ^2'],
			['a balanced bracket pair', 'Kickoff [draft]'],
			['a pipe', 'One | two'],
			['an ampersand', 'Q1 & Q2'],
		])('reads %s as literal text', (_name, text) => {
			expect(paperaMarkdownSpans.isLiteralText(text)).toBe(true);
		});

		it.each([
			['emphasis', 'a *b*'],
			['a code span', 'a `b`'],
			['a raw HTML tag', 'a <b>c</b>'],
			['a character reference', 'Q &amp; A'],
			['text that closes the label', 'x](evil) [y'],
			['a line break', 'Kickoff\nnotes'],
			['a carriage return', 'Kickoff\r\nnotes'],
		])('does not read %s as literal text', (_name, text) => {
			expect(paperaMarkdownSpans.isLiteralText(text)).toBe(false);
		});
	});

	describe('where no rule runs', () => {
		it.each([
			['a fenced code block', '```\n[Kickoff](https://papera.dev/n/unit-1)\n```\n'],
			['an indented code block', '    [Kickoff](https://papera.dev/n/unit-1)\n'],
			['a code span', 'Write `[Kickoff](https://papera.dev/n/unit-1)` to link.'],
			['a fenced code block holding a wikilink', '```\n[[Kickoff notes]]\n```\n'],
			['a code span holding a wikilink', 'Write `[[Kickoff notes]]` to link.'],
		])('reports no span inside %s', (_name, body) => {
			expect(paperaMarkdownSpans.of(body, BODY_START)).toEqual([]);
		});

		it('reports no span before the body start offset', () => {
			const frontmatter = '---\npapera_id: unit-1\n---\n';
			const body = `${frontmatter}[[Kickoff notes]]\n`;

			expect(paperaMarkdownSpans.of(body, frontmatter.length)).toEqual([
				{
					kind: 'wikilink',
					start: frontmatter.length,
					end: frontmatter.length + '[[Kickoff notes]]'.length,
					source: '[[Kickoff notes]]',
				},
			]);
		});

		it('reports no span for a reference-style link', () => {
			expect(
				paperaMarkdownSpans.of(
					'See [Kickoff]\n\n[Kickoff]: https://papera.dev/n/unit-1\n',
					BODY_START,
				),
			).toEqual([]);
		});

		it('reports no span for a wikilink whose target matches a link-reference definition', () => {
			expect(
				paperaMarkdownSpans.of(
					'See [[Kickoff]]\n\n[Kickoff]: https://papera.dev/n/unit-1\n',
					BODY_START,
				),
			).toEqual([]);
		});
	});

	describe('a list that can be spliced', () => {
		it('reports one span for a wikilink written inside a Markdown link label', () => {
			const body = '[see [[Kickoff notes]]](https://papera.dev/n/unit-1)';

			expect(paperaMarkdownSpans.of(body, BODY_START)).toEqual([
				{
					kind: 'link',
					start: 0,
					end: body.length,
					source: body,
					url: 'https://papera.dev/n/unit-1',
					text: 'see [[Kickoff notes]]',
				},
			]);
		});

		it('reports a link and a wikilink on the same line at their own offsets', () => {
			const body = '[Kickoff](https://papera.dev/n/unit-1) then [[Agenda]]';
			const spans = paperaMarkdownSpans.of(body, BODY_START);

			expect(spans.map((span) => [span.kind, span.start, span.end])).toEqual([
				['link', 0, 38],
				['wikilink', 44, 54],
			]);
			expect(body.slice(44, 54)).toBe('[[Agenda]]');
		});

		it('reports the spans in the order they appear in the body', () => {
			const spans = paperaMarkdownSpans.of(
				'[[One]]\n\n[Two](https://papera.dev/n/unit-2)\n\n![[Three.png]]\n',
				BODY_START,
			);
			const starts = spans.map((span) => span.start);

			expect(starts).toEqual([...starts].sort((one, other) => one - other));
			expect(spans).toHaveLength(3);
		});

		it('counts an offset in UTF-16 units, so an emoji before a link does not shift it', () => {
			const body = '🎉 [Kickoff](https://papera.dev/n/unit-1)';
			const [span] = paperaMarkdownSpans.of(body, BODY_START);

			expect(span && body.slice(span.start, span.end)).toBe(
				'[Kickoff](https://papera.dev/n/unit-1)',
			);
		});
	});
});
