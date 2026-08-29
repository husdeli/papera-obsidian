import type { Plugin } from 'obsidian';
import type { PaperaIndex } from '../models/paperaIndex';
import { PaperaVault } from './PaperaVault';

const INDEX_FILE_NAME = '.papera-index.json';
const INDEX_VERSION = 1;

function asRecord(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {};
	}

	return value as Record<string, unknown>;
}

function asOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}

export class PaperaVaultIndex {
	private static owned: PaperaIndex | undefined;

	static async load(plugin: Plugin): Promise<PaperaIndex> {
		const saved = await PaperaVault.readText(plugin, PaperaVaultIndex.path());

		PaperaVaultIndex.owned = PaperaVaultIndex.fromSaved(saved);

		return PaperaVaultIndex.owned;
	}

	static current(): PaperaIndex {
		if (PaperaVaultIndex.owned === undefined) {
			throw new Error('The Papera account record is read before it is loaded.');
		}

		return PaperaVaultIndex.owned;
	}

	static accountId(): string | undefined {
		return PaperaVaultIndex.current().accountId;
	}

	static async recordAccount(plugin: Plugin, accountId: string): Promise<void> {
		const record: PaperaIndex = { version: INDEX_VERSION, accountId };

		PaperaVaultIndex.owned = record;

		if (!PaperaVault.reservedRootExists(plugin)) {
			return;
		}

		await PaperaVault.writeText(plugin, PaperaVaultIndex.path(), JSON.stringify(record));
	}

	private static path(): string {
		return `${PaperaVault.reservedRoot()}/${INDEX_FILE_NAME}`;
	}

	private static fromSaved(saved: string | undefined): PaperaIndex {
		const empty: PaperaIndex = { version: INDEX_VERSION };

		if (saved === undefined) {
			return empty;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(saved);
		} catch {
			return empty;
		}

		const fields = asRecord(parsed);

		if (fields.version !== INDEX_VERSION) {
			return empty;
		}

		return { version: INDEX_VERSION, accountId: asOptionalString(fields.accountId) };
	}
}
