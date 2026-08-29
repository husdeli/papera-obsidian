import {
	type Plugin,
	TFile,
	type TFolder,
	Vault,
	getFrontMatterInfo,
	normalizePath,
	parseYaml,
} from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import { paperaFolderName } from '../domain/paperaFolderName';
import { paperaVaultScope } from '../domain/paperaVaultScope';
import { PaperaVaultScopeError } from '../models/PaperaVaultScopeError';
import { PaperaSettingsStore } from './PaperaSettingsStore';

export interface PaperaVaultNote {
	path: string;
	frontmatter: Record<string, unknown>;
}

const MARKDOWN_EXTENSION = 'md';
const EMPTY_PATH = '/';

function asRecord(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {};
	}

	return value as Record<string, unknown>;
}

export class PaperaVault {
	private static owned: string | undefined;

	static load(): string {
		const sanitized = normalizePath(
			paperaFolderName.sanitize(PaperaSettingsStore.current().reservedRoot),
		);

		PaperaVault.owned =
			sanitized === '' || sanitized === EMPTY_PATH
				? paperaConfig.defaultSettings.reservedRoot
				: sanitized;

		return PaperaVault.owned;
	}

	static reservedRoot(): string {
		if (PaperaVault.owned === undefined) {
			throw new Error('The Papera reserved root is read before it is loaded.');
		}

		return PaperaVault.owned;
	}

	static reservedRootExists(plugin: Plugin): boolean {
		return PaperaVault.reservedRootFolder(plugin) !== null;
	}

	static async readText(plugin: Plugin, path: string): Promise<string | undefined> {
		const scoped = PaperaVault.scoped(path);

		try {
			return await plugin.app.vault.adapter.read(scoped);
		} catch {
			return undefined;
		}
	}

	static async writeText(plugin: Plugin, path: string, contents: string): Promise<void> {
		await plugin.app.vault.adapter.write(PaperaVault.scoped(path), contents);
	}

	static async markdownNotes(plugin: Plugin): Promise<PaperaVaultNote[]> {
		const notes: PaperaVaultNote[] = [];

		for (const file of PaperaVault.markdownFiles(plugin)) {
			notes.push({
				path: file.path,
				frontmatter: await PaperaVault.frontmatterOf(plugin, file),
			});
		}

		return notes;
	}

	static isMetadataWarm(plugin: Plugin): boolean {
		return Object.keys(plugin.app.metadataCache.resolvedLinks).length > 0;
	}

	static onMetadataResolvedOnce(plugin: Plugin, run: () => void): void {
		let hasRun = false;

		plugin.registerEvent(
			plugin.app.metadataCache.on('resolved', () => {
				if (hasRun) {
					return;
				}

				hasRun = true;
				run();
			}),
		);
	}

	private static markdownFiles(plugin: Plugin): TFile[] {
		const folder = PaperaVault.reservedRootFolder(plugin);

		if (folder === null) {
			return [];
		}

		const files: TFile[] = [];

		Vault.recurseChildren(folder, (child) => {
			if (child instanceof TFile && child.extension === MARKDOWN_EXTENSION) {
				files.push(child);
			}
		});

		return files;
	}

	private static async frontmatterOf(
		plugin: Plugin,
		file: TFile,
	): Promise<Record<string, unknown>> {
		const cached = plugin.app.metadataCache.getFileCache(file);

		if (cached !== null) {
			return asRecord(cached.frontmatter);
		}

		try {
			return PaperaVault.frontmatterFromText(await plugin.app.vault.cachedRead(file));
		} catch {
			return {};
		}
	}

	private static frontmatterFromText(text: string): Record<string, unknown> {
		const info = getFrontMatterInfo(text);

		if (!info.exists) {
			return {};
		}

		try {
			const parsed: unknown = parseYaml(info.frontmatter);

			return asRecord(parsed);
		} catch {
			return {};
		}
	}

	private static reservedRootFolder(plugin: Plugin): TFolder | null {
		return plugin.app.vault.getFolderByPath(PaperaVault.reservedRoot());
	}

	private static scoped(path: string): string {
		const normalized = normalizePath(path);

		if (!paperaVaultScope.holds(PaperaVault.reservedRoot(), normalized)) {
			throw new PaperaVaultScopeError(
				`The Papera plugin does not manage the path ${path}.`,
			);
		}

		return normalized;
	}
}
