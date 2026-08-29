import { describe, expect, it } from 'vitest';
import { type PaperaSibling, paperaFolderName } from '../../src/domain/paperaFolderName';

const FORBIDDEN_CHARACTERS = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '#', '^', '[', ']'];
const RESERVED_DEVICE_NAMES = [
	'CON',
	'PRN',
	'AUX',
	'NUL',
	'COM1',
	'COM9',
	'LPT1',
	'LPT9',
];

function namesOf(siblings: PaperaSibling[]): string[] {
	const folderNames = paperaFolderName.forSiblings(siblings);

	return siblings.map((sibling) => folderNames.get(sibling.id) ?? '');
}

describe('paperaFolderName', () => {
	describe('the sanitizer', () => {
		it.each(FORBIDDEN_CHARACTERS)('removes %s from a name', (character) => {
			expect(paperaFolderName.sanitize(`Book${character}Club`)).not.toContain(character);
		});

		it('keeps the words of a name holding several forbidden characters', () => {
			expect(paperaFolderName.sanitize('A/B: "C"')).toBe('A B C');
		});

		it('drops a leading dot', () => {
			expect(paperaFolderName.sanitize('.hidden')).toBe('hidden');
		});

		it('drops a trailing dot', () => {
			expect(paperaFolderName.sanitize('Book Club.')).toBe('Book Club');
		});

		it('drops a trailing space', () => {
			expect(paperaFolderName.sanitize('Book Club ')).toBe('Book Club');
		});

		it('drops a control character', () => {
			expect(paperaFolderName.sanitize('Book\u0007Club')).toBe('BookClub');
		});

		it('returns an empty name for a set of dots', () => {
			expect(paperaFolderName.sanitize('...')).toBe('');
		});

		it('returns an empty name for a relative path', () => {
			expect(paperaFolderName.sanitize('../..')).toBe('');
		});

		it.each(RESERVED_DEVICE_NAMES)('adjusts the reserved device name %s', (name) => {
			expect(paperaFolderName.sanitize(name)).toBe(`_${name}`);
		});

		it.each(RESERVED_DEVICE_NAMES)('adjusts %s with an extension', (name) => {
			expect(paperaFolderName.sanitize(`${name}.txt`)).toBe(`_${name}.txt`);
		});

		it('leaves a name that only starts like a reserved device name', () => {
			expect(paperaFolderName.sanitize('Console')).toBe('Console');
		});

		it('truncates an over-long name on a UTF-8 boundary', () => {
			const sanitized = paperaFolderName.sanitize('é'.repeat(300));

			expect(new TextEncoder().encode(sanitized).length).toBeLessThanOrEqual(246);
			expect(sanitized).toBe('é'.repeat(123));
		});

		it('returns a sanitized name unchanged', () => {
			const once = paperaFolderName.sanitize('.A/B: "C" ');

			expect(paperaFolderName.sanitize(once)).toBe(once);
		});
	});

	describe('a sibling set', () => {
		it('keeps a plain name when nothing collides', () => {
			expect(namesOf([{ id: 'id-1', name: 'Book Club' }])).toEqual(['Book Club']);
		});

		it('falls back to a name derived from the id when nothing survives', () => {
			const [name] = namesOf([{ id: 'id-1', name: '...' }]);

			expect(name).toMatch(/^Untitled \([0-9a-f]{6}\)$/);
		});

		it('gives the same fallback name for the same id on two devices', () => {
			expect(namesOf([{ id: 'id-1', name: '...' }])).toEqual(
				namesOf([{ id: 'id-1', name: '???' }]),
			);
		});

		it('separates two names that differ only by case', () => {
			const [first, second] = namesOf([
				{ id: 'id-1', name: 'Book Club' },
				{ id: 'id-2', name: 'book club' },
			]);

			expect(first).toBe('Book Club');
			expect(second).toMatch(/^book club \([0-9a-f]{6}\)$/);
		});

		it('separates three colliding names', () => {
			const names = namesOf([
				{ id: 'id-1', name: 'Book Club' },
				{ id: 'id-2', name: 'Book Club' },
				{ id: 'id-3', name: 'Book Club' },
			]);

			expect(new Set(names).size).toBe(3);
			expect(names[0]).toBe('Book Club');
		});

		it('gives one result whichever order the siblings arrive in', () => {
			const siblings: PaperaSibling[] = [
				{ id: 'id-2', name: 'Book Club' },
				{ id: 'id-1', name: 'Book Club' },
				{ id: 'id-3', name: 'Notes' },
			];
			const forwards = paperaFolderName.forSiblings(siblings);
			const backwards = paperaFolderName.forSiblings([...siblings].reverse());

			expect([...forwards.entries()].sort()).toEqual([...backwards.entries()].sort());
			expect(forwards.get('id-1')).toBe('Book Club');
		});
	});
});
