import type { Plugin } from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import type { PaperaSettings } from '../models/paperaSettings';

export class PaperaSettingsStore {
	static async load(plugin: Plugin): Promise<PaperaSettings> {
		const saved: unknown = await plugin.loadData();

		return PaperaSettingsStore.fromSaved(saved);
	}

	static async save(plugin: Plugin, settings: PaperaSettings): Promise<void> {
		await plugin.saveData(settings);
	}

	private static fromSaved(saved: unknown): PaperaSettings {
		const fields = PaperaSettingsStore.asRecord(saved);

		return {
			baseUrl: PaperaSettingsStore.asString(
				fields.baseUrl,
				paperaConfig.defaultSettings.baseUrl,
			),
		};
	}

	private static asRecord(value: unknown): Record<string, unknown> {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			return {};
		}

		return value as Record<string, unknown>;
	}

	private static asString(value: unknown, fallback: string): string {
		return typeof value === 'string' ? value : fallback;
	}
}
