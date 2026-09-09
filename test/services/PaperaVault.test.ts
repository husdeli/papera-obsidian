import { type Plugin, type TAbstractFile, TFile, TFolder } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaVaultScopeError } from '../../src/models/PaperaVaultScopeError';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';
import { PaperaVault } from '../../src/services/PaperaVault';

const ROOT = 'Papera';
const NOTE_PATH = 'Papera/Book Club/Drafts/note.md';
const OUTSIDE_PATH = 'Journal/note.md';
const INDEX_PATH = 'Papera/.papera-index.json';

const texts = new Map<string, string>();
const folders = new Map<string, TFolder>();

function fileAt(path: string): TFile {
	return Object.assign(new TFile(), { path });
}

function folderAt(path: string, children: TAbstractFile[] = []): TFolder {
	return Object.assign(new TFolder(), { path, children });
}

const files = new Map<string, TFile>();

function vaultWith(root: TFolder | null) {
	return {
		getFolderByPath: vi.fn((path: string) => (path === ROOT ? root : (folders.get(path) ?? null))),
		getFileByPath: vi.fn((path: string) => files.get(path) ?? null),
		getAbstractFileByPath: vi.fn(
			(path: string): TAbstractFile | null => files.get(path) ?? folders.get(path) ?? null,
		),
		create: vi.fn(() => Promise.resolve()),
		createFolder: vi.fn(() => Promise.resolve()),
		process: vi.fn((_file: TFile, change: (data: string) => string) =>
			Promise.resolve(change('old')),
		),
		cachedRead: vi.fn((file: TFile) => Promise.resolve(texts.get(file.path) ?? '')),
		adapter: {
			read: vi.fn(() => Promise.resolve('{}')),
			write: vi.fn(() => Promise.resolve()),
		},
	};
}

function fileManagerStub() {
	return {
		renameFile: vi.fn(() => Promise.resolve()),
		trashFile: vi.fn(() => Promise.resolve()),
	};
}

function metadataWith(
	frontmatter: Map<string, Record<string, unknown> | null>,
	targets = new Map<string, string>(),
) {
	return {
		getFileCache: vi.fn((file: TFile) => {
			const cached = frontmatter.get(file.path);

			return cached === undefined || cached === null ? null : { frontmatter: cached };
		}),
		getFirstLinkpathDest: vi.fn((linkpath: string, sourcePath: string) => {
			const found = targets.get(`${sourcePath}|${linkpath}`);

			return found === undefined ? null : fileAt(found);
		}),
		resolvedLinks: {} as Record<string, unknown>,
		on: vi.fn((name: string, callback: () => void) => ({ name, callback })),
	};
}

function pluginWith(vault: ReturnType<typeof vaultWith>, metadataCache = metadataWith(new Map())) {
	const fileManager = fileManagerStub();
	const plugin = {
		app: { vault, metadataCache, fileManager },
		registerEvent: vi.fn(),
	};

	return { plugin, fileManager, asPlugin: plugin as unknown as Plugin };
}

async function loadReservedRoot(reservedRoot: unknown): Promise<void> {
	const store = {
		loadData: vi.fn().mockResolvedValue({ reservedRoot }),
		saveData: vi.fn(),
	};

	await PaperaSettingsStore.load(store as unknown as Plugin);
	PaperaVault.load();
}

describe('PaperaVault', () => {
	beforeEach(async () => {
		texts.clear();
		folders.clear();
		files.clear();
		await loadReservedRoot(ROOT);
	});

	describe('the reserved root', () => {
		it('reads the folder name from the settings', () => {
			expect(PaperaVault.reservedRoot()).toBe(ROOT);
		});

		it('falls back to Papera when the saved name sanitizes to nothing', async () => {
			await loadReservedRoot('...');

			expect(PaperaVault.reservedRoot()).toBe('Papera');
		});

		it('reports whether the reserved root folder exists', () => {
			const { asPlugin } = pluginWith(vaultWith(null));

			expect(PaperaVault.reservedRootExists(asPlugin)).toBe(false);
			expect(
				PaperaVault.reservedRootExists(pluginWith(vaultWith(folderAt(ROOT))).asPlugin),
			).toBe(true);
		});
	});

	describe('the scope check', () => {
		it('refuses to read a path outside the reserved root', async () => {
			const vault = vaultWith(null);
			const { asPlugin } = pluginWith(vault);

			await expect(PaperaVault.readText(asPlugin, OUTSIDE_PATH)).rejects.toBeInstanceOf(
				PaperaVaultScopeError,
			);
			expect(vault.adapter.read).not.toHaveBeenCalled();
		});

		it('refuses to write a path outside the reserved root', async () => {
			const vault = vaultWith(null);
			const { asPlugin } = pluginWith(vault);

			await expect(
				PaperaVault.writeText(asPlugin, 'Papera/../Journal/note.md', '{}'),
			).rejects.toBeInstanceOf(PaperaVaultScopeError);
			expect(vault.adapter.write).not.toHaveBeenCalled();
		});
	});

	describe('the index file', () => {
		it('reads the file through the adapter', async () => {
			const vault = vaultWith(null);
			const { asPlugin } = pluginWith(vault);

			await expect(PaperaVault.readText(asPlugin, INDEX_PATH)).resolves.toBe('{}');
			expect(vault.adapter.read).toHaveBeenCalledWith(INDEX_PATH);
		});

		it('reads an absent answer when the adapter fails', async () => {
			const vault = vaultWith(null);

			vault.adapter.read.mockRejectedValue(new Error('ENOENT'));

			await expect(
				PaperaVault.readText(pluginWith(vault).asPlugin, INDEX_PATH),
			).resolves.toBeUndefined();
		});

		it('writes the file through the adapter', async () => {
			const vault = vaultWith(null);

			await PaperaVault.writeText(pluginWith(vault).asPlugin, INDEX_PATH, '{"version":1}');

			expect(vault.adapter.write).toHaveBeenCalledWith(INDEX_PATH, '{"version":1}');
		});
	});

	describe('the folder creation', () => {
		it('creates a folder that is missing', async () => {
			const vault = vaultWith(null);

			await PaperaVault.createFolder(pluginWith(vault).asPlugin, 'Papera/Acme');

			expect(vault.createFolder).toHaveBeenCalledWith('Papera/Acme');
		});

		it('creates nothing when the folder already exists', async () => {
			const vault = vaultWith(null);

			folders.set('Papera/Acme', folderAt('Papera/Acme'));

			await PaperaVault.createFolder(pluginWith(vault).asPlugin, 'Papera/Acme');

			expect(vault.createFolder).not.toHaveBeenCalled();
		});

		it('tolerates a folder another writer created first', async () => {
			const vault = vaultWith(null);

			vault.createFolder.mockRejectedValue(new Error('Folder already exists.'));

			await expect(
				PaperaVault.createFolder(pluginWith(vault).asPlugin, 'Papera/Acme'),
			).resolves.toBeUndefined();
		});

		it('refuses a folder outside the reserved root', async () => {
			const vault = vaultWith(null);

			await expect(
				PaperaVault.createFolder(pluginWith(vault).asPlugin, 'Journal/Acme'),
			).rejects.toBeInstanceOf(PaperaVaultScopeError);
			expect(vault.createFolder).not.toHaveBeenCalled();
		});
	});

	describe('the note write', () => {
		const contents = {
			id: 'unit-1',
			revision: 7,
			lastChangedAt: '2026-08-30T10:00:00Z',
			body: 'Body\n',
		};

		it('creates a note carrying the identity block', async () => {
			const vault = vaultWith(null);

			await PaperaVault.writeNote(pluginWith(vault).asPlugin, NOTE_PATH, contents);

			expect(vault.create).toHaveBeenCalledWith(
				NOTE_PATH,
				'---\npapera_id: unit-1\npapera_rev: 7\nupdated_at: 2026-08-30T10:00:00Z\n---\nBody\n',
			);
			expect(vault.process).not.toHaveBeenCalled();
		});

		it('replaces the whole text of a note that already exists', async () => {
			const vault = vaultWith(null);

			files.set(NOTE_PATH, fileAt(NOTE_PATH));

			await PaperaVault.writeNote(pluginWith(vault).asPlugin, NOTE_PATH, contents);

			expect(vault.create).not.toHaveBeenCalled();
			await expect(vault.process.mock.results[0]?.value).resolves.toBe(
				'---\npapera_id: unit-1\npapera_rev: 7\nupdated_at: 2026-08-30T10:00:00Z\n---\nBody\n',
			);
		});

		it('leaves out a revision and a change time it does not know', async () => {
			const vault = vaultWith(null);

			await PaperaVault.writeNote(pluginWith(vault).asPlugin, NOTE_PATH, {
				id: 'unit-1',
				body: 'Body\n',
			});

			expect(vault.create).toHaveBeenCalledWith(NOTE_PATH, '---\npapera_id: unit-1\n---\nBody\n');
		});

		it('refuses a note outside the reserved root', async () => {
			const vault = vaultWith(null);

			await expect(
				PaperaVault.writeNote(pluginWith(vault).asPlugin, OUTSIDE_PATH, contents),
			).rejects.toBeInstanceOf(PaperaVaultScopeError);
			expect(vault.create).not.toHaveBeenCalled();
		});

		it('marks the path it wrote as its own write', async () => {
			const vault = vaultWith(null);

			await PaperaVault.writeNote(pluginWith(vault).asPlugin, NOTE_PATH, contents);

			expect(PaperaVault.isSelfWrite(NOTE_PATH)).toBe(true);

			PaperaVault.forgetSelfWrite(NOTE_PATH);

			expect(PaperaVault.isSelfWrite(NOTE_PATH)).toBe(false);
		});
	});

	describe('the rename', () => {
		const MOVED_PATH = 'Papera/Book Club/Drafts/renamed.md';

		it('renames through the Obsidian file manager', async () => {
			const vault = vaultWith(null);
			const note = fileAt(NOTE_PATH);

			files.set(NOTE_PATH, note);

			const { fileManager, asPlugin } = pluginWith(vault);

			await PaperaVault.renamePath(asPlugin, NOTE_PATH, MOVED_PATH);

			expect(fileManager.renameFile).toHaveBeenCalledWith(note, MOVED_PATH);
			expect(vault.create).not.toHaveBeenCalled();
			expect(vault.process).not.toHaveBeenCalled();
		});

		it('renames a folder as well as a note', async () => {
			const vault = vaultWith(null);
			const folder = folderAt('Papera/Acme');

			folders.set('Papera/Acme', folder);

			const { fileManager, asPlugin } = pluginWith(vault);

			await PaperaVault.renamePath(asPlugin, 'Papera/Acme', 'Papera/Acme Inc');

			expect(fileManager.renameFile).toHaveBeenCalledWith(folder, 'Papera/Acme Inc');
		});

		it('renames nothing when the path holds no file', async () => {
			const { fileManager, asPlugin } = pluginWith(vaultWith(null));

			await PaperaVault.renamePath(asPlugin, NOTE_PATH, MOVED_PATH);

			expect(fileManager.renameFile).not.toHaveBeenCalled();
		});

		it.each([
			['the source', OUTSIDE_PATH, MOVED_PATH],
			['the destination', NOTE_PATH, OUTSIDE_PATH],
		])('refuses a rename whose %s sits outside the reserved root', async (_name, from, to) => {
			files.set(NOTE_PATH, fileAt(NOTE_PATH));

			const { fileManager, asPlugin } = pluginWith(vaultWith(null));

			await expect(PaperaVault.renamePath(asPlugin, from, to)).rejects.toBeInstanceOf(
				PaperaVaultScopeError,
			);
			expect(fileManager.renameFile).not.toHaveBeenCalled();
		});
	});

	describe('the removal', () => {
		it('removes a note through the trash the person chose', async () => {
			const note = fileAt(NOTE_PATH);

			files.set(NOTE_PATH, note);

			const { fileManager, asPlugin } = pluginWith(vaultWith(null));

			await PaperaVault.removeNote(asPlugin, NOTE_PATH);

			expect(fileManager.trashFile).toHaveBeenCalledWith(note);
		});

		it('removes nothing when the note is already gone', async () => {
			const { fileManager, asPlugin } = pluginWith(vaultWith(null));

			await PaperaVault.removeNote(asPlugin, NOTE_PATH);

			expect(fileManager.trashFile).not.toHaveBeenCalled();
		});

		it('refuses a note outside the reserved root', async () => {
			const { fileManager, asPlugin } = pluginWith(vaultWith(null));

			await expect(PaperaVault.removeNote(asPlugin, OUTSIDE_PATH)).rejects.toBeInstanceOf(
				PaperaVaultScopeError,
			);
			expect(fileManager.trashFile).not.toHaveBeenCalled();
		});
	});

	describe('the Markdown notes', () => {
		it('returns no note when the reserved root folder is missing', async () => {
			await expect(
				PaperaVault.markdownNotes(pluginWith(vaultWith(null)).asPlugin),
			).resolves.toEqual([]);
		});

		it('reads the frontmatter of every note under the reserved root', async () => {
			const note = fileAt(NOTE_PATH);
			const folder = folderAt(ROOT, [
				folderAt('Papera/Book Club', [
					folderAt('Papera/Book Club/Drafts', [
						note,
						fileAt('Papera/Book Club/Drafts/cover.png'),
					]),
				]),
			]);
			const metadataCache = metadataWith(new Map([[NOTE_PATH, { papera_id: 'unit-1' }]]));
			const { asPlugin } = pluginWith(vaultWith(folder), metadataCache);

			await expect(PaperaVault.markdownNotes(asPlugin)).resolves.toEqual([
				{ path: NOTE_PATH, frontmatter: { papera_id: 'unit-1' } },
			]);
		});

		it('reads the file itself when the metadata cache holds no entry', async () => {
			const note = fileAt(NOTE_PATH);
			const vault = vaultWith(folderAt(ROOT, [note]));

			texts.set(NOTE_PATH, '---\npapera_id: unit-1\npapera_rev: 4\n---\nBody\n');

			const { asPlugin } = pluginWith(vault, metadataWith(new Map([[NOTE_PATH, null]])));

			await expect(PaperaVault.markdownNotes(asPlugin)).resolves.toEqual([
				{ path: NOTE_PATH, frontmatter: { papera_id: 'unit-1', papera_rev: 4 } },
			]);
			expect(vault.cachedRead).toHaveBeenCalledTimes(1);
		});

		it('reads no frontmatter when the file read fails', async () => {
			const note = fileAt(NOTE_PATH);
			const vault = vaultWith(folderAt(ROOT, [note]));

			vault.cachedRead.mockRejectedValue(new Error('ENOENT'));

			const { asPlugin } = pluginWith(vault, metadataWith(new Map([[NOTE_PATH, null]])));

			await expect(PaperaVault.markdownNotes(asPlugin)).resolves.toEqual([
				{ path: NOTE_PATH, frontmatter: {} },
			]);
		});
	});

	describe('the wikilink target', () => {
		it('answers the vault path Obsidian resolves the target to', () => {
			const metadataCache = metadataWith(
				new Map(),
				new Map([[`${NOTE_PATH}|Kickoff notes`, 'Papera/Acme/Research/Kickoff notes.md']]),
			);
			const { asPlugin } = pluginWith(vaultWith(null), metadataCache);

			expect(PaperaVault.linkTargetPath(asPlugin, NOTE_PATH, 'Kickoff notes')).toBe(
				'Papera/Acme/Research/Kickoff notes.md',
			);
			expect(metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
				'Kickoff notes',
				NOTE_PATH,
			);
		});

		it('answers nothing for a target that resolves to no file', () => {
			const { asPlugin } = pluginWith(vaultWith(null));

			expect(PaperaVault.linkTargetPath(asPlugin, NOTE_PATH, 'Missing note')).toBeUndefined();
		});
	});

	describe('the metadata cache', () => {
		it('reports a warm cache once resolvedLinks holds an entry', () => {
			const cold = metadataWith(new Map());
			const warm = metadataWith(new Map());

			warm.resolvedLinks = { [NOTE_PATH]: {} };

			expect(PaperaVault.isMetadataWarm(pluginWith(vaultWith(null), cold).asPlugin)).toBe(
				false,
			);
			expect(PaperaVault.isMetadataWarm(pluginWith(vaultWith(null), warm).asPlugin)).toBe(
				true,
			);
		});

		it('runs the resolved callback once across two events', () => {
			const metadataCache = metadataWith(new Map());
			const { plugin, asPlugin } = pluginWith(vaultWith(null), metadataCache);
			const run = vi.fn();

			PaperaVault.onMetadataResolvedOnce(asPlugin, run);

			const registered = metadataCache.on.mock.calls[0]?.[1];

			registered?.();
			registered?.();

			expect(run).toHaveBeenCalledTimes(1);
			expect(plugin.registerEvent).toHaveBeenCalledTimes(1);
		});
	});
});
