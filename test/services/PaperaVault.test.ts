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

function fileAt(path: string): TFile {
	return Object.assign(new TFile(), { path });
}

function folderAt(path: string, children: TAbstractFile[] = []): TFolder {
	return Object.assign(new TFolder(), { path, children });
}

function vaultWith(root: TFolder | null) {
	return {
		getFolderByPath: vi.fn(() => root),
		cachedRead: vi.fn((file: TFile) => Promise.resolve(texts.get(file.path) ?? '')),
		adapter: {
			read: vi.fn(() => Promise.resolve('{}')),
			write: vi.fn(() => Promise.resolve()),
		},
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
	const plugin = {
		app: { vault, metadataCache },
		registerEvent: vi.fn(),
	};

	return { plugin, asPlugin: plugin as unknown as Plugin };
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
