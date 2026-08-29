import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaperaVaultNote } from '../../src/services/PaperaVault';
import { PaperaVaultMap } from '../../src/services/PaperaVaultMap';

const vault = vi.hoisted(() => ({
	reservedRoot: vi.fn(() => 'Papera'),
	markdownNotes: vi.fn((): Promise<PaperaVaultNote[]> => Promise.resolve([])),
}));

vi.mock('../../src/services/PaperaVault', () => ({ PaperaVault: vault }));

const plugin = {} as Plugin;

const FIRST_NOTE = 'Papera/Book Club/Drafts/one.md';
const SECOND_NOTE = 'Papera/Book Club/Sent/two.md';
const THIRD_NOTE = 'Papera/Notes/Inbox/three.md';

function noteAt(path: string, frontmatter: Record<string, unknown>): PaperaVaultNote {
	return { path, frontmatter };
}

function forgetMap(): void {
	const internals = PaperaVaultMap as unknown as {
		owned: Map<string, unknown>;
		building: Promise<void> | undefined;
		built: unknown;
	};

	internals.owned = new Map();
	internals.building = undefined;
	internals.built = undefined;
}

async function buildFrom(notes: PaperaVaultNote[]): Promise<void> {
	vault.markdownNotes.mockResolvedValue(notes);

	await PaperaVaultMap.build(plugin);
}

describe('PaperaVaultMap', () => {
	beforeEach(() => {
		forgetMap();
		vault.markdownNotes.mockReset().mockResolvedValue([]);
	});

	it('holds one entry per note across two workflows', async () => {
		await buildFrom([
			noteAt(FIRST_NOTE, { papera_id: 'unit-1' }),
			noteAt(SECOND_NOTE, { papera_id: 'unit-2' }),
			noteAt(THIRD_NOTE, { papera_id: 'unit-3' }),
		]);

		expect(PaperaVaultMap.get('unit-1')?.path).toBe(FIRST_NOTE);
		expect(PaperaVaultMap.get('unit-2')?.path).toBe(SECOND_NOTE);
		expect(PaperaVaultMap.get('unit-3')?.path).toBe(THIRD_NOTE);
	});

	it('skips a note carrying no papera_id', async () => {
		await buildFrom([noteAt(FIRST_NOTE, { papera_rev: 1 })]);

		expect(PaperaVaultMap.get('unit-1')).toBeUndefined();
	});

	it('skips a papera_id that is not a string', async () => {
		await buildFrom([noteAt(FIRST_NOTE, { papera_id: 42 })]);

		expect(PaperaVaultMap.get('42')).toBeUndefined();
	});

	it('skips a note one segment under the reserved root', async () => {
		await buildFrom([noteAt('Papera/note.md', { papera_id: 'unit-1' })]);

		expect(PaperaVaultMap.get('unit-1')).toBeUndefined();
	});

	it('skips a note four segments under the reserved root', async () => {
		await buildFrom([noteAt('Papera/a/b/c/note.md', { papera_id: 'unit-1' })]);

		expect(PaperaVaultMap.get('unit-1')).toBeUndefined();
	});

	it('records the revision from papera_rev', async () => {
		await buildFrom([noteAt(FIRST_NOTE, { papera_id: 'unit-1', papera_rev: 7 })]);

		expect(PaperaVaultMap.get('unit-1')?.revision).toBe(7);
	});

	it('drops a revision that is not a number', async () => {
		await buildFrom([noteAt(FIRST_NOTE, { papera_id: 'unit-1', papera_rev: 'seven' })]);

		expect(PaperaVaultMap.get('unit-1')?.revision).toBeUndefined();
	});

	it.each([
		['the note first', [FIRST_NOTE, 'Papera/Book Club/Drafts/one (conflict 2026-08-28).md']],
		['the conflict copy first', ['Papera/Book Club/Drafts/one (conflict 2026-08-28).md', FIRST_NOTE]],
	])('keeps the shorter path when %s carries a known id', async (_name, paths) => {
		await buildFrom(paths.map((path) => noteAt(path, { papera_id: 'unit-1' })));

		expect(PaperaVaultMap.get('unit-1')?.path).toBe(FIRST_NOTE);
	});

	it('records an entry a caller puts by id', async () => {
		await buildFrom([]);
		PaperaVaultMap.put('project-1', { path: 'Papera/Book Club' });

		expect(PaperaVaultMap.get('project-1')?.path).toBe('Papera/Book Club');
	});

	it('walks the vault once when the build is asked for twice', async () => {
		vault.markdownNotes.mockResolvedValue([noteAt(FIRST_NOTE, { papera_id: 'unit-1' })]);

		await Promise.all([PaperaVaultMap.build(plugin), PaperaVaultMap.build(plugin)]);

		expect(vault.markdownNotes).toHaveBeenCalledTimes(1);
	});

	it('reports readiness only once the build completes', async () => {
		let ready = false;

		void PaperaVaultMap.ready().then(() => {
			ready = true;
		});

		await Promise.resolve();
		expect(ready).toBe(false);

		await buildFrom([noteAt(FIRST_NOTE, { papera_id: 'unit-1' })]);
		await PaperaVaultMap.ready();

		expect(ready).toBe(true);
	});

	it('reports readiness with an empty map when the reserved root folder is missing', async () => {
		await buildFrom([]);

		await expect(PaperaVaultMap.ready()).resolves.toBeUndefined();
		expect(PaperaVaultMap.get('unit-1')).toBeUndefined();
	});
});
