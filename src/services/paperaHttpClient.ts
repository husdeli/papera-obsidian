import { type RequestUrlResponse, requestUrl } from 'obsidian';
import { PaperaHttpError } from '../models/PaperaHttpError';

export interface PaperaHttpRequest {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

const TRANSPORT_FAILURE_STATUS = 0;
const LOWEST_ERROR_STATUS = 400;

async function send(request: PaperaHttpRequest): Promise<RequestUrlResponse> {
	// requestUrl parses the body as JSON on its own, so a malformed body throws even with throw: false.
	try {
		return await requestUrl({ ...request, throw: false });
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'The request could not be sent.';

		throw new PaperaHttpError(TRANSPORT_FAILURE_STATUS, reason);
	}
}

export const paperaHttpClient = {
	async requestJson<T>(request: PaperaHttpRequest): Promise<T | undefined> {
		const response = await send(request);
		const body = response.text;

		if (response.status >= LOWEST_ERROR_STATUS) {
			throw new PaperaHttpError(response.status, body);
		}

		if (body.trim() === '') {
			return undefined;
		}

		try {
			return JSON.parse(body) as T;
		} catch {
			throw new PaperaHttpError(response.status, body);
		}
	},
};
