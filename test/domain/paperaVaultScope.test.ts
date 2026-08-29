import { describe, expect, it } from 'vitest';
import { paperaVaultScope } from '../../src/domain/paperaVaultScope';
import { PaperaVaultScopeError } from '../../src/models/PaperaVaultScopeError';

const ROOT = 'Papera';

describe('paperaVaultScope', () => {
	it('holds a path inside the reserved root', () => {
		expect(paperaVaultScope.holds(ROOT, 'Papera/Book Club/Drafts/note.md')).toBe(true);
	});

	it('holds the reserved root itself', () => {
		expect(paperaVaultScope.holds(ROOT, ROOT)).toBe(true);
	});

	it('refuses a path outside the reserved root', () => {
		expect(paperaVaultScope.holds(ROOT, 'Journal/note.md')).toBe(false);
	});

	it('refuses a sibling folder whose name starts with the reserved root name', () => {
		expect(paperaVaultScope.holds(ROOT, 'Papera Notes/note.md')).toBe(false);
	});

	it('refuses a relative segment in the middle of a path', () => {
		expect(paperaVaultScope.holds(ROOT, 'Papera/../Journal/note.md')).toBe(false);
	});

	it('refuses a relative segment at the end of a path', () => {
		expect(paperaVaultScope.holds(ROOT, 'Papera/Book Club/..')).toBe(false);
	});

	it('refuses a single dot segment', () => {
		expect(paperaVaultScope.holds(ROOT, 'Papera/./note.md')).toBe(false);
	});

	it('refuses a root segment that differs only by case', () => {
		expect(paperaVaultScope.holds(ROOT, 'papera/note.md')).toBe(false);
	});

	it('refuses an empty path', () => {
		expect(paperaVaultScope.holds(ROOT, '')).toBe(false);
	});

	it('throws when the reserved root has no name', () => {
		expect(() => paperaVaultScope.holds('', 'Papera/note.md')).toThrow(PaperaVaultScopeError);
	});
});
