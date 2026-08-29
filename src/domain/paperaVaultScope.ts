import { PaperaVaultScopeError } from '../models/PaperaVaultScopeError';

const RELATIVE_SEGMENTS = ['.', '..'];

function holdsRelativeSegment(path: string): boolean {
	return path.split('/').some((segment) => RELATIVE_SEGMENTS.includes(segment));
}

export const paperaVaultScope = {
	// The comparison is case-sensitive, matching Vault.getAbstractFileByPath, so an unsure answer is "outside".
	holds(reservedRoot: string, candidate: string): boolean {
		if (reservedRoot === '') {
			throw new PaperaVaultScopeError('The Papera reserved root folder has no name.');
		}

		if (candidate === '' || holdsRelativeSegment(candidate)) {
			return false;
		}

		return candidate === reservedRoot || candidate.startsWith(`${reservedRoot}/`);
	},
};
