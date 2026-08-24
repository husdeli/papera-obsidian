export class PaperaHttpError extends Error {
	constructor(
		readonly status: number,
		readonly body: string,
	) {
		super(`The Papera request failed with status ${status}`);
		this.name = 'PaperaHttpError';
	}
}
