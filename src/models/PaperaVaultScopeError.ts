export class PaperaVaultScopeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PaperaVaultScopeError';
	}
}
