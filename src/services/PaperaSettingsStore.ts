import type { Plugin } from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import type { PaperaPendingSignIn, PaperaSettings } from '../models/paperaSettings';

export class PaperaSettingsStore {
	private static owned: PaperaSettings | undefined;

	static async load(plugin: Plugin): Promise<PaperaSettings> {
		const saved: unknown = await plugin.loadData();

		PaperaSettingsStore.owned = PaperaSettingsStore.fromSaved(saved);

		return PaperaSettingsStore.owned;
	}

	static current(): PaperaSettings {
		if (PaperaSettingsStore.owned === undefined) {
			throw new Error('The Papera settings are read before they are loaded.');
		}

		return PaperaSettingsStore.owned;
	}

	static async update(plugin: Plugin, change: Partial<PaperaSettings>): Promise<PaperaSettings> {
		const updated = { ...PaperaSettingsStore.current(), ...change };

		PaperaSettingsStore.owned = updated;
		await plugin.saveData(updated);

		return updated;
	}

	private static fromSaved(saved: unknown): PaperaSettings {
		const fields = PaperaSettingsStore.asRecord(saved);

		return {
			baseUrl: PaperaSettingsStore.asString(
				fields.baseUrl,
				paperaConfig.defaultSettings.baseUrl,
			),
			reservedRoot: PaperaSettingsStore.asFolderName(
				fields.reservedRoot,
				paperaConfig.defaultSettings.reservedRoot,
			),
			clientId: PaperaSettingsStore.asOptionalString(fields.clientId),
			accessToken: PaperaSettingsStore.asOptionalString(fields.accessToken),
			refreshToken: PaperaSettingsStore.asOptionalString(fields.refreshToken),
			accessTokenExpiresAt: PaperaSettingsStore.asOptionalNumber(fields.accessTokenExpiresAt),
			accountId: PaperaSettingsStore.asOptionalString(fields.accountId),
			pendingSignIn: PaperaSettingsStore.asPendingSignIn(fields.pendingSignIn),
			syncedProjectIds: PaperaSettingsStore.asProjectIds(fields.syncedProjectIds),
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

	private static asFolderName(value: unknown, fallback: string): string {
		if (typeof value !== 'string' || value.trim() === '' || /[/\\]/.test(value)) {
			return fallback;
		}

		return value;
	}

	private static asOptionalString(value: unknown): string | undefined {
		return typeof value === 'string' ? value : undefined;
	}

	private static asOptionalNumber(value: unknown): number | undefined {
		return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
	}

	private static asProjectIds(value: unknown): string[] | undefined {
		if (!Array.isArray(value)) {
			return undefined;
		}

		const ids = value as unknown[];

		return ids.every((id) => typeof id === 'string' && id !== '')
			? (ids as string[])
			: undefined;
	}

	private static asPendingSignIn(value: unknown): PaperaPendingSignIn | undefined {
		const fields = PaperaSettingsStore.asRecord(value);
		const state = PaperaSettingsStore.asOptionalString(fields.state);
		const codeVerifier = PaperaSettingsStore.asOptionalString(fields.codeVerifier);
		const createdAt = PaperaSettingsStore.asOptionalNumber(fields.createdAt);

		if (state === undefined || codeVerifier === undefined || createdAt === undefined) {
			return undefined;
		}

		return { state, codeVerifier, createdAt };
	}
}
