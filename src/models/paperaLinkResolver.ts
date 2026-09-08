export interface PaperaLinkResolver {
	vaultPathOf(contentUnitId: string): string | undefined;
	titleOf(contentUnitId: string): string | undefined;
	contentUnitIdAt(vaultPath: string): string | undefined;
	targetOf(sourceVaultPath: string, linkTarget: string): string | undefined;
	attachmentPathOf(attachmentId: string): string | undefined;
}
