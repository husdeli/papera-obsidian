export class PaperaAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PaperaAuthError';
	}
}
