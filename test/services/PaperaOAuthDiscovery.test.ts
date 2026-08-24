import { type RequestUrlResponse, requestUrl } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type PaperaOAuthEndpoints,
	PaperaOAuthDiscovery,
} from '../../src/services/PaperaOAuthDiscovery';

const metadata = {
	authorization_endpoint: 'https://papera.dev/oauth2/authorize',
	token_endpoint: 'https://papera.dev/oauth2/token',
	registration_endpoint: 'https://papera.dev/oauth2/register',
	revocation_endpoint: 'https://papera.dev/oauth2/revoke',
	code_challenge_methods_supported: ['S256'],
};

function answerWith(status: number, text: string): RequestUrlResponse {
	return { status, headers: {}, arrayBuffer: new ArrayBuffer(0), json: null, text };
}

function forgetDiscoveredEndpoints(): void {
	(
		PaperaOAuthDiscovery as unknown as {
			endpointsByBaseUrl: Map<string, PaperaOAuthEndpoints>;
		}
	).endpointsByBaseUrl.clear();
}

describe('PaperaOAuthDiscovery', () => {
	beforeEach(() => {
		forgetDiscoveredEndpoints();
		vi.mocked(requestUrl).mockReset();
	});

	it('reads the four endpoints from a valid document', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(200, JSON.stringify(metadata)));

		await expect(PaperaOAuthDiscovery.endpoints('https://papera.dev')).resolves.toEqual({
			authorize: 'https://papera.dev/oauth2/authorize',
			token: 'https://papera.dev/oauth2/token',
			register: 'https://papera.dev/oauth2/register',
			revoke: 'https://papera.dev/oauth2/revoke',
		});
	});

	it('reads the document from the origin of a base URL that carries a path', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(200, JSON.stringify(metadata)));

		await PaperaOAuthDiscovery.endpoints('https://papera.dev/app/workspace');

		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://papera.dev/.well-known/oauth-authorization-server',
			}),
		);
	});

	it('asks the server once per base URL', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(200, JSON.stringify(metadata)));

		await PaperaOAuthDiscovery.endpoints('https://papera.dev');
		await PaperaOAuthDiscovery.endpoints('https://papera.dev');

		expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(1);
	});

	it('raises when the document is empty', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(200, ''));

		await expect(PaperaOAuthDiscovery.endpoints('https://papera.dev')).rejects.toThrow(
			/no document/,
		);
	});

	it('refuses a document that does not offer S256', async () => {
		vi.mocked(requestUrl).mockResolvedValue(
			answerWith(
				200,
				JSON.stringify({ ...metadata, code_challenge_methods_supported: ['plain'] }),
			),
		);

		await expect(PaperaOAuthDiscovery.endpoints('https://papera.dev')).rejects.toThrow(/S256/);
	});

	it('raises when the document has no token endpoint', async () => {
		vi.mocked(requestUrl).mockResolvedValue(
			answerWith(200, JSON.stringify({ ...metadata, token_endpoint: undefined })),
		);

		await expect(PaperaOAuthDiscovery.endpoints('https://papera.dev')).rejects.toThrow(
			/token_endpoint/,
		);
	});
});
