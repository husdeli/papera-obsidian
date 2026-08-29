export interface PaperaSibling {
	id: string;
	name: string;
}

const FORBIDDEN_CHARACTERS = /[/\\:*?"<>|#^[\]]/g;
const WHITESPACE_RUN = /\s+/g;
const LEADING_DOTS = /^\.+/;
const TRAILING_DOTS_AND_SPACES = /[.\s]+$/;
const RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
const LOWEST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;
const SUFFIX_DIGITS = 6;
const SUFFIX_BYTES = ' (000000)'.length;
const MAX_NAME_BYTES = 255;
const FALLBACK_STEM = 'Untitled';
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX = 16;

const encoder = new TextEncoder();

function withoutControlCharacters(name: string): string {
	let kept = '';

	for (const character of name) {
		const code = character.codePointAt(0) ?? 0;

		if (code >= LOWEST_PRINTABLE_CODE && code !== DELETE_CODE) {
			kept += character;
		}
	}

	return kept;
}

function withoutForbiddenCharacters(name: string): string {
	return withoutControlCharacters(
		name.replace(FORBIDDEN_CHARACTERS, ' ').replace(WHITESPACE_RUN, ' '),
	);
}

function withoutEdgeDotsAndSpaces(name: string): string {
	return name.replace(LEADING_DOTS, '').replace(TRAILING_DOTS_AND_SPACES, '').trim();
}

function withoutReservedDeviceName(name: string): string {
	const stem = name.split('.')[0] ?? '';

	return RESERVED_DEVICE_NAME.test(stem.toLowerCase()) ? `_${name}` : name;
}

function truncatedToByteBudget(name: string): string {
	const budget = MAX_NAME_BYTES - SUFFIX_BYTES;

	if (encoder.encode(name).length <= budget) {
		return name;
	}

	let kept = '';

	for (const character of name) {
		if (encoder.encode(kept + character).length > budget) {
			break;
		}

		kept += character;
	}

	return kept;
}

function shortIdOf(id: string): string {
	let hash = FNV_OFFSET_BASIS;

	for (let index = 0; index < id.length; index += 1) {
		hash = Math.imul(hash ^ id.charCodeAt(index), FNV_PRIME);
	}

	return (hash >>> 0).toString(HEX).padStart(SUFFIX_DIGITS, '0').slice(-SUFFIX_DIGITS);
}

function nameOf(sibling: PaperaSibling): string {
	const sanitized = paperaFolderName.sanitize(sibling.name);

	return sanitized === '' ? `${FALLBACK_STEM} (${shortIdOf(sibling.id)})` : sanitized;
}

function groupedBySharedName(siblings: PaperaSibling[]): Map<string, PaperaSibling[]> {
	const groups = new Map<string, PaperaSibling[]>();

	for (const sibling of siblings) {
		const named = { id: sibling.id, name: nameOf(sibling) };
		const key = named.name.normalize('NFC').toLowerCase();

		groups.set(key, [...(groups.get(key) ?? []), named]);
	}

	return groups;
}

export const paperaFolderName = {
	sanitize(name: string): string {
		const safe = withoutReservedDeviceName(
			withoutEdgeDotsAndSpaces(withoutForbiddenCharacters(name)),
		);

		return withoutEdgeDotsAndSpaces(truncatedToByteBudget(safe));
	},

	forSiblings(siblings: PaperaSibling[]): Map<string, string> {
		const folderNames = new Map<string, string>();

		for (const group of groupedBySharedName(siblings).values()) {
			const sorted = [...group].sort((one, other) => (one.id < other.id ? -1 : 1));

			for (const [position, sibling] of sorted.entries()) {
				folderNames.set(
					sibling.id,
					position === 0 ? sibling.name : `${sibling.name} (${shortIdOf(sibling.id)})`,
				);
			}
		}

		return folderNames;
	},
};
