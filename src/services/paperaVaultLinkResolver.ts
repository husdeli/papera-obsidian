import type { Plugin } from 'obsidian';
import type { PaperaLinkResolver } from '../models/paperaLinkResolver';
import { PaperaVault } from './PaperaVault';
import { PaperaVaultMap } from './PaperaVaultMap';

export const paperaVaultLinkResolver = {
	for(plugin: Plugin): PaperaLinkResolver {
		return {
			vaultPathOf: (contentUnitId) => PaperaVaultMap.get(contentUnitId)?.path,
			titleOf: (contentUnitId) => PaperaVaultMap.titleOf(contentUnitId),
			contentUnitIdAt: (vaultPath) => PaperaVaultMap.idAt(vaultPath),
			targetOf: (sourceVaultPath, linkTarget) =>
				PaperaVault.linkTargetPath(plugin, sourceVaultPath, linkTarget),
			attachmentPathOf: () => PaperaVaultMap.attachmentPathOf(),
		};
	},
};
