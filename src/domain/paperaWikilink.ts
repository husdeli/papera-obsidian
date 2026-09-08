import { paperaMarkdownSpans } from './paperaMarkdownSpans';

export interface PaperaVaultLink {
	target: string;
	alias?: string;
	heading?: string;
	embed?: boolean;
}

export interface PaperaLinkTargetParts {
	target: string;
	heading?: string;
	blockId?: string;
}

export interface PaperaWikilinkParts extends PaperaLinkTargetParts {
	embed: boolean;
	alias?: string;
}

const WIKILINK = /^(!?)\[\[([^[\]\n]*)\]\]$/;
const ALIAS_FORCES_MARKDOWN = /[|[\]]/;
const WIKILINK_TEXT_ESCAPE = /[|[\]]/g;
const MARKDOWN_TEXT_ESCAPE = /[!-/:-@[-`{-~]/g;
const MARKDOWN_TEXT_UNESCAPE = /\\([!-/:-@[-`{-~])/g;
const NOTE_EXTENSION = '.md';
const BLOCK_MARKER = '^';
const AUTOLINK_OPENING = '<';

function withoutNoteExtension(target: string): string {
	return target.endsWith(NOTE_EXTENSION) ? target.slice(0, -NOTE_EXTENSION.length) : target;
}

function decodedDestination(destination: string): string {
	try {
		return decodeURIComponent(destination);
	} catch {
		return destination;
	}
}

function encodedDestination(destination: string): string {
	return destination.split('/').map(encodeURIComponent).join('/');
}

function splitFragment(target: string): PaperaLinkTargetParts {
	const marker = target.indexOf('#');

	if (marker < 0) {
		return { target };
	}

	const fragment = target.slice(marker + 1);
	const withoutFragment = target.slice(0, marker);

	if (fragment.startsWith(BLOCK_MARKER)) {
		return { target: withoutFragment, blockId: fragment.slice(BLOCK_MARKER.length) };
	}

	return { target: withoutFragment, heading: fragment };
}

// A pipe is escaped in every position, not only inside a table cell, because no CommonMark node reports a table cell.
function escapedDisplayText(text: string): string {
	return paperaMarkdownSpans.isLiteralText(text)
		? text.replace(WIKILINK_TEXT_ESCAPE, '\\$&')
		: text.replace(MARKDOWN_TEXT_ESCAPE, '\\$&');
}

function aliasForcesMarkdownForm(alias: string): boolean {
	return ALIAS_FORCES_MARKDOWN.test(alias) || !paperaMarkdownSpans.isLiteralText(alias);
}

function markdownForm(link: PaperaVaultLink): string {
	const prefix = link.embed === true ? '!' : '';
	const fragment = link.heading === undefined ? '' : `#${encodeURIComponent(link.heading)}`;
	const text = escapedDisplayText(link.alias ?? '');

	return `${prefix}[${text}](${encodedDestination(withoutNoteExtension(link.target))}${fragment})`;
}

export const paperaWikilink = {
	escapedDisplayText,

	write(link: PaperaVaultLink): string {
		const embed = link.embed === true;

		if (link.alias !== undefined && (embed || aliasForcesMarkdownForm(link.alias))) {
			return markdownForm(link);
		}

		const heading = link.heading === undefined ? '' : `#${link.heading}`;
		const alias = link.alias === undefined ? '' : `|${link.alias}`;

		return `${embed ? '!' : ''}[[${withoutNoteExtension(link.target)}${heading}${alias}]]`;
	},

	read(source: string): PaperaWikilinkParts | undefined {
		const match = WIKILINK.exec(source);
		const written = match?.[2];

		if (match === null || written === undefined) {
			return undefined;
		}

		const separator = written.indexOf('|');
		const named = separator < 0 ? written : written.slice(0, separator);
		const alias =
			separator < 0
				? undefined
				: written.slice(separator + 1).replace(MARKDOWN_TEXT_UNESCAPE, '$1');

		return { embed: match[1] === '!', alias, ...splitFragment(named) };
	},

	readDestination(destination: string): PaperaLinkTargetParts {
		return splitFragment(decodedDestination(destination));
	},

	noteNameOf(vaultPath: string): string {
		const name = vaultPath.split('/').pop() ?? vaultPath;

		return withoutNoteExtension(name);
	},

	isAutolink(source: string): boolean {
		return source.startsWith(AUTOLINK_OPENING);
	},
};
