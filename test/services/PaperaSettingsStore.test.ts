import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paperaConfig } from '../../src/config/papera.config';
import type { PaperaSettings } from '../../src/models/paperaSettings';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';

function pluginWith(saved: unknown) {
	const plugin = {
		loadData: vi.fn().mockResolvedValue(saved),
		saveData: vi.fn().mockResolvedValue(undefined),
	};

	return { plugin, asPlugin: plugin as unknown as Plugin };
}

function forgetOwnedSettings(): void {
	(PaperaSettingsStore as unknown as { owned: PaperaSettings | undefined }).owned = undefined;
}

describe('PaperaSettingsStore', () => {
	beforeEach(() => {
		forgetOwnedSettings();
	});

	it('falls back to the defaults when nothing is saved', async () => {
		const { asPlugin } = pluginWith(null);

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toEqual({
			baseUrl: paperaConfig.defaultSettings.baseUrl,
			reservedRoot: paperaConfig.defaultSettings.reservedRoot,
		});
	});

	it('keeps a saved field over its default', async () => {
		const { asPlugin } = pluginWith({ baseUrl: 'https://staging.papera.dev' });

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toEqual({
			baseUrl: 'https://staging.papera.dev',
			reservedRoot: paperaConfig.defaultSettings.reservedRoot,
		});
	});

	it('falls back to the default when a saved field has the wrong type', async () => {
		const { asPlugin } = pluginWith({ baseUrl: 42 });

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toEqual({
			baseUrl: paperaConfig.defaultSettings.baseUrl,
			reservedRoot: paperaConfig.defaultSettings.reservedRoot,
		});
	});

	it('keeps a saved reserved root folder name', async () => {
		const { asPlugin } = pluginWith({ reservedRoot: 'Writing' });

		const settings = await PaperaSettingsStore.load(asPlugin);

		expect(settings.reservedRoot).toBe('Writing');
	});

	it.each([
		['is missing', undefined],
		['is empty', '   '],
		['has the wrong type', 42],
		['holds a forward slash', 'Work/Papera'],
		['holds a backslash', 'Work\\Papera'],
	])('falls back to Papera when the saved reserved root %s', async (_name, saved) => {
		const { asPlugin } = pluginWith({ reservedRoot: saved });

		const settings = await PaperaSettingsStore.load(asPlugin);

		expect(settings.reservedRoot).toBe('Papera');
	});

	it('keeps the saved tokens, the expiry and the account', async () => {
		const { asPlugin } = pluginWith({
			baseUrl: paperaConfig.defaultSettings.baseUrl,
			clientId: 'client-1',
			accessToken: 'access-1',
			refreshToken: 'refresh-1',
			accessTokenExpiresAt: 1_700_000_000_000,
			accountId: 'account-1',
		});

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toMatchObject({
			clientId: 'client-1',
			accessToken: 'access-1',
			refreshToken: 'refresh-1',
			accessTokenExpiresAt: 1_700_000_000_000,
			accountId: 'account-1',
		});
	});

	it('drops a saved access token expiry that is not a number', async () => {
		const { asPlugin } = pluginWith({ accessTokenExpiresAt: '1700000000000' });

		const settings = await PaperaSettingsStore.load(asPlugin);

		expect(settings.accessTokenExpiresAt).toBeUndefined();
	});

	it('keeps a complete pending sign-in request', async () => {
		const pendingSignIn = { state: 'state-1', codeVerifier: 'verifier-1', createdAt: 10 };
		const { asPlugin } = pluginWith({ pendingSignIn });

		const settings = await PaperaSettingsStore.load(asPlugin);

		expect(settings.pendingSignIn).toEqual(pendingSignIn);
	});

	it('drops a pending sign-in request that is not a record', async () => {
		const { asPlugin } = pluginWith({ pendingSignIn: 'state-1' });

		const settings = await PaperaSettingsStore.load(asPlugin);

		expect(settings.pendingSignIn).toBeUndefined();
	});

	it('drops a pending sign-in request with a field of the wrong type', async () => {
		const { asPlugin } = pluginWith({
			pendingSignIn: { state: 'state-1', codeVerifier: 'verifier-1', createdAt: 'now' },
		});

		const settings = await PaperaSettingsStore.load(asPlugin);

		expect(settings.pendingSignIn).toBeUndefined();
	});

	it('saves the merged settings when one field changes', async () => {
		const { plugin, asPlugin } = pluginWith({ baseUrl: 'https://staging.papera.dev' });

		await PaperaSettingsStore.load(asPlugin);
		await PaperaSettingsStore.update(asPlugin, { accessToken: 'access-1' });

		expect(plugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({
				baseUrl: 'https://staging.papera.dev',
				accessToken: 'access-1',
			}),
		);
	});

	it('keeps the first change when a second update follows it', async () => {
		const { plugin, asPlugin } = pluginWith({});

		await PaperaSettingsStore.load(asPlugin);
		await PaperaSettingsStore.update(asPlugin, { accessToken: 'access-1' });
		await PaperaSettingsStore.update(asPlugin, { refreshToken: 'refresh-1' });

		expect(plugin.saveData).toHaveBeenLastCalledWith(
			expect.objectContaining({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
		);
		expect(PaperaSettingsStore.current().accessToken).toBe('access-1');
	});

	it('refuses to read the settings before they are loaded', () => {
		expect(() => PaperaSettingsStore.current()).toThrow();
	});
});
