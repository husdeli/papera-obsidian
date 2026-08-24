import { type RequestUrlResponse, requestUrl } from 'obsidian';
import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaHttpError } from '../../src/models/PaperaHttpError';
import { paperaAuthorizedHttpClient } from '../../src/services/paperaAuthorizedHttpClient';

const session = vi.hoisted(() => ({
	accessToken: vi.fn(),
	refreshAccessToken: vi.fn(),
}));

vi.mock('../../src/services/PaperaSession', () => ({ PaperaSession: session }));

const asPlugin = {} as Plugin;
const request = { url: 'https://papera.dev/api/sync/projects' };

function answerWith(status: number, text: string): RequestUrlResponse {
	return { status, headers: {}, arrayBuffer: new ArrayBuffer(0), json: null, text };
}

function authorizationOfCall(index: number): string | undefined {
	const sent = vi.mocked(requestUrl).mock.calls[index]?.[0] as {
		headers?: Record<string, string>;
	};

	return sent.headers?.Authorization;
}

describe('paperaAuthorizedHttpClient', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset();
		session.accessToken.mockReset().mockResolvedValue('access-1');
		session.refreshAccessToken.mockReset().mockResolvedValue('access-2');
	});

	it('attaches the access token to the request', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(200, '{"id":"p1"}'));

		await expect(paperaAuthorizedHttpClient.requestJson(asPlugin, request)).resolves.toEqual({
			id: 'p1',
		});
		expect(authorizationOfCall(0)).toBe('Bearer access-1');
	});

	it('refreshes once and retries once after a 401', async () => {
		vi.mocked(requestUrl)
			.mockResolvedValueOnce(answerWith(401, 'Unauthorized'))
			.mockResolvedValueOnce(answerWith(200, '{"id":"p1"}'));

		await expect(paperaAuthorizedHttpClient.requestJson(asPlugin, request)).resolves.toEqual({
			id: 'p1',
		});
		expect(session.refreshAccessToken).toHaveBeenCalledTimes(1);
		expect(authorizationOfCall(1)).toBe('Bearer access-2');
	});

	it('raises when the retry meets a second 401', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(401, 'Unauthorized'));

		await expect(
			paperaAuthorizedHttpClient.requestJson(asPlugin, request),
		).rejects.toBeInstanceOf(PaperaHttpError);
		expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
		expect(session.refreshAccessToken).toHaveBeenCalledTimes(1);
	});

	it('does not retry any other failing status', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(500, 'Internal Server Error'));

		await expect(
			paperaAuthorizedHttpClient.requestJson(asPlugin, request),
		).rejects.toBeInstanceOf(PaperaHttpError);
		expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(1);
	});
});
