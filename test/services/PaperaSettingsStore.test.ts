import type { Plugin } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { paperaConfig } from '../../src/config/papera.config';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';

function pluginWith(saved: unknown) {
	const plugin = {
		loadData: vi.fn().mockResolvedValue(saved),
		saveData: vi.fn().mockResolvedValue(undefined),
	};

	return { plugin, asPlugin: plugin as unknown as Plugin };
}

describe('PaperaSettingsStore', () => {
	it('falls back to the defaults when nothing is saved', async () => {
		const { asPlugin } = pluginWith(null);

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toEqual({
			baseUrl: paperaConfig.defaultSettings.baseUrl,
		});
	});

	it('keeps a saved field over its default', async () => {
		const { asPlugin } = pluginWith({ baseUrl: 'https://staging.papera.app' });

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toEqual({
			baseUrl: 'https://staging.papera.app',
		});
	});

	it('falls back to the default when a saved field has the wrong type', async () => {
		const { asPlugin } = pluginWith({ baseUrl: 42 });

		await expect(PaperaSettingsStore.load(asPlugin)).resolves.toEqual({
			baseUrl: paperaConfig.defaultSettings.baseUrl,
		});
	});

	it('saves the whole settings object', async () => {
		const { plugin, asPlugin } = pluginWith({});
		const settings = { baseUrl: 'https://staging.papera.app' };

		await PaperaSettingsStore.save(asPlugin, settings);

		expect(plugin.saveData).toHaveBeenCalledWith(settings);
	});
});
