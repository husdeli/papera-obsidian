import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paperaVaultLinkResolver } from '../../src/services/paperaVaultLinkResolver';

const vault = vi.hoisted(() => ({
	linkTargetPath: vi.fn((): string | undefined => undefined),
}));

vi.mock('../../src/services/PaperaVault', () => ({ PaperaVault: vault }));

const map = vi.hoisted(() => ({
	get: vi.fn((): { path: string } | undefined => undefined),
	titleOf: vi.fn((): string | undefined => undefined),
	idAt: vi.fn((): string | undefined => undefined),
	attachmentPathOf: vi.fn((): string | undefined => undefined),
}));

vi.mock('../../src/services/PaperaVaultMap', () => ({ PaperaVaultMap: map }));

const plugin = {} as Plugin;
const NOTE_PATH = 'Papera/Acme/Research/Kickoff notes.md';

describe('paperaVaultLinkResolver', () => {
	beforeEach(() => {
		vault.linkTargetPath.mockReset();
		map.get.mockReset();
		map.titleOf.mockReset();
		map.idAt.mockReset();
		map.attachmentPathOf.mockReset();
	});

	it('answers the vault path the map holds for a content unit', () => {
		map.get.mockReturnValue({ path: NOTE_PATH });

		expect(paperaVaultLinkResolver.for(plugin).vaultPathOf('unit-1')).toBe(NOTE_PATH);
		expect(map.get).toHaveBeenCalledWith('unit-1');
	});

	it('answers the title the map holds', () => {
		map.titleOf.mockReturnValue('Kickoff notes');

		expect(paperaVaultLinkResolver.for(plugin).titleOf('unit-1')).toBe('Kickoff notes');
		expect(map.titleOf).toHaveBeenCalledWith('unit-1');
	});

	it('answers the content unit id at a vault path', () => {
		map.idAt.mockReturnValue('unit-1');

		expect(paperaVaultLinkResolver.for(plugin).contentUnitIdAt(NOTE_PATH)).toBe('unit-1');
		expect(map.idAt).toHaveBeenCalledWith(NOTE_PATH);
	});

	it('answers the path Obsidian resolves a wikilink target to', () => {
		vault.linkTargetPath.mockReturnValue(NOTE_PATH);

		expect(paperaVaultLinkResolver.for(plugin).targetOf(NOTE_PATH, 'Kickoff notes')).toBe(
			NOTE_PATH,
		);
		expect(vault.linkTargetPath).toHaveBeenCalledWith(plugin, NOTE_PATH, 'Kickoff notes');
	});

	it('answers no attachment path while no map holds one', () => {
		expect(paperaVaultLinkResolver.for(plugin).attachmentPathOf('attachment-1')).toBeUndefined();
		expect(map.attachmentPathOf).toHaveBeenCalledTimes(1);
	});
});
