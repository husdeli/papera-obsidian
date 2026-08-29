import type { Plugin } from 'obsidian';
import type { PaperaVaultEntry } from '../models/paperaVaultEntry';
import { PaperaVault, type PaperaVaultNote } from './PaperaVault';

interface PaperaMapBuild {
	promise: Promise<void>;
	settle: () => void;
}

const ID_FIELD = 'papera_id';
const REVISION_FIELD = 'papera_rev';
const NOTE_DEPTH_UNDER_ROOT = 3;

function newBuild(): PaperaMapBuild {
	let settle = (): void => {};
	const promise = new Promise<void>((resolve) => {
		settle = resolve;
	});

	return { promise, settle };
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}

function asRevision(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function depthUnderRoot(path: string, reservedRoot: string): number {
	return path.split('/').length - reservedRoot.split('/').length;
}

function shorterPath(one: string, other: string): string {
	if (one.length !== other.length) {
		return one.length < other.length ? one : other;
	}

	return one < other ? one : other;
}

export class PaperaVaultMap {
	private static owned = new Map<string, PaperaVaultEntry>();
	private static building: Promise<void> | undefined;
	private static built: PaperaMapBuild | undefined;

	static async build(plugin: Plugin): Promise<void> {
		PaperaVaultMap.building ??= PaperaVaultMap.fill(plugin);

		await PaperaVaultMap.building;
	}

	static ready(): Promise<void> {
		return PaperaVaultMap.awaitedBuild().promise;
	}

	static get(id: string): PaperaVaultEntry | undefined {
		return PaperaVaultMap.owned.get(id);
	}

	static put(id: string, entry: PaperaVaultEntry): void {
		PaperaVaultMap.owned.set(id, entry);
	}

	private static async fill(plugin: Plugin): Promise<void> {
		const reservedRoot = PaperaVault.reservedRoot();

		try {
			for (const note of await PaperaVault.markdownNotes(plugin)) {
				PaperaVaultMap.remember(note, reservedRoot);
			}
		} finally {
			PaperaVaultMap.awaitedBuild().settle();
		}
	}

	private static awaitedBuild(): PaperaMapBuild {
		PaperaVaultMap.built ??= newBuild();

		return PaperaVaultMap.built;
	}

	private static remember(note: PaperaVaultNote, reservedRoot: string): void {
		const id = asString(note.frontmatter[ID_FIELD]);

		if (id === undefined || depthUnderRoot(note.path, reservedRoot) !== NOTE_DEPTH_UNDER_ROOT) {
			return;
		}

		const known = PaperaVaultMap.owned.get(id);

		if (known !== undefined && shorterPath(known.path, note.path) === known.path) {
			return;
		}

		PaperaVaultMap.owned.set(id, {
			path: note.path,
			revision: asRevision(note.frontmatter[REVISION_FIELD]),
		});
	}
}
