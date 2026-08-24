import { type RequestUrlResponse, requestUrl } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaHttpError } from '../../src/models/PaperaHttpError';
import { paperaHttpClient } from '../../src/services/paperaHttpClient';

function responseWith(status: number, text: string): RequestUrlResponse {
	return {
		status,
		headers: {},
		arrayBuffer: new ArrayBuffer(0),
		json: null,
		text,
	};
}

describe('paperaHttpClient', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset();
	});

	it('returns the parsed body of a successful request', async () => {
		vi.mocked(requestUrl).mockResolvedValue(responseWith(200, '{"id":"p1"}'));

		await expect(
			paperaHttpClient.requestJson({
				url: 'https://papera.app/api/sync/projects',
				headers: { Authorization: 'Bearer token' },
			}),
		).resolves.toEqual({ id: 'p1' });

		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith({
			url: 'https://papera.app/api/sync/projects',
			headers: { Authorization: 'Bearer token' },
			throw: false,
		});
	});

	it('returns no value when a successful response has an empty body', async () => {
		vi.mocked(requestUrl).mockResolvedValue(responseWith(204, ''));

		await expect(
			paperaHttpClient.requestJson({ url: 'https://papera.app/api/sync/projects' }),
		).resolves.toBeUndefined();
	});

	it('raises the status and the body of a client error', async () => {
		vi.mocked(requestUrl).mockResolvedValue(responseWith(403, '{"error":"forbidden"}'));

		await expect(
			paperaHttpClient.requestJson({ url: 'https://papera.app/api/sync/projects' }),
		).rejects.toMatchObject({
			status: 403,
			body: '{"error":"forbidden"}',
		});
	});

	it('raises the status and the body of a server error', async () => {
		vi.mocked(requestUrl).mockResolvedValue(responseWith(500, 'Internal Server Error'));

		await expect(
			paperaHttpClient.requestJson({ url: 'https://papera.app/api/sync/projects' }),
		).rejects.toMatchObject({
			status: 500,
			body: 'Internal Server Error',
		});
	});

	it('raises the status and the body when the body is not JSON', async () => {
		vi.mocked(requestUrl).mockResolvedValue(responseWith(200, '<html>Sign in</html>'));

		await expect(
			paperaHttpClient.requestJson({ url: 'https://papera.app/api/sync/projects' }),
		).rejects.toMatchObject({
			status: 200,
			body: '<html>Sign in</html>',
		});
	});

	it('raises a transport failure when the request itself throws', async () => {
		vi.mocked(requestUrl).mockRejectedValue(new Error('Unexpected end of JSON input'));

		await expect(
			paperaHttpClient.requestJson({ url: 'https://papera.app/api/sync/projects' }),
		).rejects.toMatchObject({
			status: 0,
			body: 'Unexpected end of JSON input',
		});
	});

	it('raises PaperaHttpError for a failing request', async () => {
		vi.mocked(requestUrl).mockResolvedValue(responseWith(404, 'not found'));

		await expect(
			paperaHttpClient.requestJson({ url: 'https://papera.app/api/sync/projects' }),
		).rejects.toBeInstanceOf(PaperaHttpError);
	});
});
