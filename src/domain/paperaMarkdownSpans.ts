import type { Image, Link, Nodes, Parents, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';

interface PaperaSpanBounds {
	start: number;
	end: number;
	source: string;
}

export interface PaperaLinkSpan extends PaperaSpanBounds {
	kind: 'link' | 'image';
	url: string;
	text?: string;
}

export interface PaperaWikilinkSpan extends PaperaSpanBounds {
	kind: 'wikilink';
}

export type PaperaMarkdownSpan = PaperaLinkSpan | PaperaWikilinkSpan;

export interface PaperaSpanEdit {
	start: number;
	end: number;
	text: string;
}

const WIKILINK = /!?\[\[[^[\]\n]*\]\]/g;
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const LINE_BREAK = /[\r\n]/;
const INLINE_CONTAINERS = ['paragraph', 'heading', 'tableCell'];
const OPAQUE_INLINE = ['linkReference', 'imageReference', 'inlineCode', 'html'];

function boundsOf(node: Nodes, body: string, bodyStart: number): PaperaSpanBounds | undefined {
	const from = node.position?.start.offset;
	const to = node.position?.end.offset;

	if (from === undefined || to === undefined) {
		return undefined;
	}

	const start = from + bodyStart;
	const end = to + bodyStart;

	return { start, end, source: body.slice(start, end) };
}

function literalTextOf(children: RootContent[]): string | undefined {
	let text = '';

	for (const child of children) {
		if (child.type !== 'text') {
			return undefined;
		}

		text += child.value;
	}

	return text;
}

function lonelyLinkIn(source: string): Link | undefined {
	const tree = fromMarkdown(source);
	const paragraph = tree.children[0];

	if (tree.children.length !== 1 || paragraph?.type !== 'paragraph') {
		return undefined;
	}

	const link = paragraph.children[0];

	return paragraph.children.length === 1 && link?.type === 'link' ? link : undefined;
}

function altTextOf(source: string): string | undefined {
	const link = lonelyLinkIn(source.slice('!'.length));

	return link === undefined ? undefined : literalTextOf(link.children);
}

function linkSpanOf(node: Link | Image, bounds: PaperaSpanBounds): PaperaLinkSpan {
	return {
		...bounds,
		kind: node.type,
		url: node.url,
		text: node.type === 'image' ? altTextOf(bounds.source) : literalTextOf(node.children),
	};
}

function wikilinksBetween(body: string, from: number, to: number): PaperaWikilinkSpan[] {
	const spans: PaperaWikilinkSpan[] = [];

	for (const match of body.slice(from, to).matchAll(WIKILINK)) {
		const written = match[0];
		const at = match.index;

		if (at !== undefined) {
			spans.push({
				kind: 'wikilink',
				start: from + at,
				end: from + at + written.length,
				source: written,
			});
		}
	}

	return spans;
}

// A wikilink is read from the raw source between the inline nodes, because inline markup inside an alias splits the text into several nodes.
function collectInline(
	container: Parents,
	body: string,
	bodyStart: number,
	spans: PaperaMarkdownSpan[],
): void {
	const bounds = boundsOf(container, body, bodyStart);

	if (bounds === undefined) {
		return;
	}

	const found: PaperaMarkdownSpan[] = [];
	const covered: PaperaSpanBounds[] = [];

	const visit = (node: Nodes): void => {
		const inline = boundsOf(node, body, bodyStart);

		if (node.type === 'link' || node.type === 'image') {
			if (inline !== undefined) {
				covered.push(inline);
				found.push(linkSpanOf(node, inline));
			}

			return;
		}

		if (OPAQUE_INLINE.includes(node.type)) {
			if (inline !== undefined) {
				covered.push(inline);
			}

			return;
		}

		if ('children' in node) {
			for (const child of node.children) {
				visit(child);
			}
		}
	};

	for (const child of container.children) {
		visit(child);
	}

	let scanned = bounds.start;

	for (const range of covered) {
		found.push(...wikilinksBetween(body, scanned, range.start));
		scanned = Math.max(scanned, range.end);
	}

	found.push(...wikilinksBetween(body, scanned, bounds.end));
	found.sort((one, other) => one.start - other.start);
	spans.push(...found);
}

function collect(node: Nodes, body: string, bodyStart: number, spans: PaperaMarkdownSpan[]): void {
	if (INLINE_CONTAINERS.includes(node.type) && 'children' in node) {
		collectInline(node, body, bodyStart, spans);

		return;
	}

	if ('children' in node) {
		for (const child of node.children) {
			collect(child, body, bodyStart, spans);
		}
	}
}

function isSpliceable(spans: PaperaMarkdownSpan[]): boolean {
	let spliced = 0;

	for (const span of spans) {
		if (span.start < spliced || span.end < span.start) {
			return false;
		}

		spliced = span.end;
	}

	return true;
}

export const paperaMarkdownSpans = {
	of(body: string, bodyStart: number): PaperaMarkdownSpan[] {
		const spans: PaperaMarkdownSpan[] = [];

		collect(fromMarkdown(body.slice(bodyStart)), body, bodyStart, spans);

		return isSpliceable(spans) ? spans : [];
	},

	// A line break is no literal text, because a wikilink alias holds one line and Obsidian resolves no target across two.
	isLiteralText(text: string): boolean {
		if (LINE_BREAK.test(text)) {
			return false;
		}

		if (!ASCII_PUNCTUATION.test(text)) {
			return true;
		}

		const link = lonelyLinkIn(`[${text}](#)`);

		return link?.url === '#' && literalTextOf(link.children) === text;
	},

	spliced(body: string, edits: PaperaSpanEdit[]): string {
		let written = '';
		let taken = 0;

		for (const edit of edits) {
			written += body.slice(taken, edit.start) + edit.text;
			taken = edit.end;
		}

		return written + body.slice(taken);
	},
};
