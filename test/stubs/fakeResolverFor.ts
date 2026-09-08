import type { PaperaLinkResolver } from '../../src/models/paperaLinkResolver';

export interface FakeContentUnit {
	path: string;
	title?: string;
}

export interface FakeVault {
	notes?: Record<string, FakeContentUnit>;
	attachments?: Record<string, string>;
	targets?: Record<string, string>;
}

export function fakeResolverFor(vault: FakeVault): PaperaLinkResolver {
	const notes = vault.notes ?? {};
	const attachments = vault.attachments ?? {};
	const targets = vault.targets ?? {};

	return {
		vaultPathOf: (contentUnitId) => notes[contentUnitId]?.path,
		titleOf: (contentUnitId) => notes[contentUnitId]?.title,
		contentUnitIdAt: (vaultPath) =>
			Object.keys(notes).find((id) => notes[id]?.path === vaultPath),
		targetOf: (_sourceVaultPath, linkTarget) => targets[linkTarget],
		attachmentPathOf: (attachmentId) => attachments[attachmentId],
	};
}
