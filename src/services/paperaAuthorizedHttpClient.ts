import type { Plugin } from 'obsidian';
import { PaperaHttpError } from '../models/PaperaHttpError';
import { PaperaSession } from './PaperaSession';
import { type PaperaHttpRequest, paperaHttpClient } from './paperaHttpClient';

const UNAUTHORIZED_STATUS = 401;

function withAccessToken(request: PaperaHttpRequest, accessToken: string): PaperaHttpRequest {
	return {
		...request,
		headers: { ...request.headers, Authorization: `Bearer ${accessToken}` },
	};
}

export const paperaAuthorizedHttpClient = {
	async requestJson<T>(plugin: Plugin, request: PaperaHttpRequest): Promise<T | undefined> {
		const accessToken = await PaperaSession.accessToken(plugin);

		try {
			return await paperaHttpClient.requestJson<T>(withAccessToken(request, accessToken));
		} catch (error) {
			if (!(error instanceof PaperaHttpError) || error.status !== UNAUTHORIZED_STATUS) {
				throw error;
			}

			const refreshed = await PaperaSession.refreshAccessToken(plugin);

			return await paperaHttpClient.requestJson<T>(withAccessToken(request, refreshed));
		}
	},
};
