import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaperaIndex } from '../../src/models/paperaIndex';
import { PaperaVaultIndex } from '../../src/services/PaperaVaultIndex';

const vault = vi.hoisted(() => ({
	reservedRoot: vi.fn(() => 'Papera'),
	reservedRootExists: vi.fn(() => true),
	readText: vi.fn((): Promise<string | undefined> => Promise.resolve(undefined)),
	writeText: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/services/PaperaVault', () => ({ PaperaVault: vault }));

const plugin = {} as Plugin;
const INDEX_PATH = 'Papera/.papera-index.json';

function forgetAccountRecord(): void {
	(PaperaVaultIndex as unknown as { owned: PaperaIndex | undefined }).owned = undefined;
}

async function loadFrom(saved: string | undefined): Promise<PaperaIndex> {
	vault.readText.mockResolvedValue(saved);

	return PaperaVaultIndex.load(plugin);
}

describe('PaperaVaultIndex', () => {
	beforeEach(() => {
		forgetAccountRecord();
		vault.readText.mockReset().mockResolvedValue(undefined);
		vault.writeText.mockReset().mockResolvedValue(undefined);
		vault.reservedRootExists.mockReset().mockReturnValue(true);
	});

	it('reads the file from under the reserved root', async () => {
		await loadFrom(undefined);

		expect(vault.readText).toHaveBeenCalledWith(plugin, INDEX_PATH);
	});

	it('records an account and reads it back', async () => {
		const written = JSON.stringify({ version: 1, accountId: 'account-1' });

		await loadFrom(undefined);
		await PaperaVaultIndex.recordAccount(plugin, 'account-1');

		expect(vault.writeText).toHaveBeenCalledWith(plugin, INDEX_PATH, written);
		expect(PaperaVaultIndex.accountId()).toBe('account-1');

		await loadFrom(written);

		expect(PaperaVaultIndex.accountId()).toBe('account-1');
	});

	it.each([
		['an absent read answer', undefined],
		['malformed JSON', '{'],
		['a shape that is not a record', '"account-1"'],
		['an unknown version', '{"version":2,"accountId":"account-1"}'],
	])('names no account after %s', async (_name, saved) => {
		await expect(loadFrom(saved)).resolves.toEqual({ version: 1 });
		expect(PaperaVaultIndex.accountId()).toBeUndefined();
	});

	it('writes nothing when the reserved root folder does not exist', async () => {
		vault.reservedRootExists.mockReturnValue(false);

		await loadFrom(undefined);
		await PaperaVaultIndex.recordAccount(plugin, 'account-1');

		expect(vault.writeText).not.toHaveBeenCalled();
		expect(PaperaVaultIndex.accountId()).toBe('account-1');
	});

	it('refuses to read the account record before it is loaded', () => {
		expect(() => PaperaVaultIndex.accountId()).toThrow();
	});
});
