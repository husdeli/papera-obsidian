import { type RequestUrlResponse, requestUrl } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaOAuthClient } from '../../src/services/PaperaOAuthClient';
import {
	type PaperaOAuthEndpoints,
	PaperaOAuthDiscovery,
} from '../../src/services/PaperaOAuthDiscovery';

const BASE_URL = 'https://papera.dev';

const endpoints: PaperaOAuthEndpoints = {
	authorize: 'https://papera.dev/oauth2/authorize',
	token: 'https://papera.dev/oauth2/token',
	register: 'https://papera.dev/oauth2/register',
	revoke: 'https://papera.dev/oauth2/revoke',
};

function answerWith(text: string): RequestUrlResponse {
	return { status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), json: null, text };
}

function seedDiscoveredEndpoints(): void {
	(
		PaperaOAuthDiscovery as unknown as {
			endpointsByBaseUrl: Map<string, PaperaOAuthEndpoints>;
		}
	).endpointsByBaseUrl.set(BASE_URL, endpoints);
}

function sentRequest(): { url: string; contentType?: string; body?: string } {
	return vi.mocked(requestUrl).mock.calls[0]?.[0] as {
		url: string;
		contentType?: string;
		body?: string;
	};
}

describe('PaperaOAuthClient', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset();
		seedDiscoveredEndpoints();
	});

	it('registers a public native client with no client secret', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith('{"client_id":"client-1"}'));

		await expect(PaperaOAuthClient.registerClient(BASE_URL)).resolves.toBe('client-1');

		const request = sentRequest();
		const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>;

		expect(request.url).toBe(endpoints.register);
		expect(request.contentType).toBe('application/json');
		expect(request.body).not.toContain('client_secret');
		expect(body).toMatchObject({
			redirect_uris: ['obsidian://papera-auth'],
			token_endpoint_auth_method: 'none',
			application_type: 'native',
			grant_types: ['authorization_code', 'refresh_token'],
			scope: 'sync:read offline_access',
		});
	});

	it('raises when the registration answer carries no client id', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith('{}'));

		await expect(PaperaOAuthClient.registerClient(BASE_URL)).rejects.toThrow(/client id/);
	});

	it('builds an authorization URL with the challenge, the state and the two scopes', async () => {
		const url = new URL(
			await PaperaOAuthClient.authorizationUrl(BASE_URL, {
				clientId: 'client-1',
				state: 'state-1',
				codeChallenge: 'challenge-1',
			}),
		);

		expect(url.origin + url.pathname).toBe(endpoints.authorize);
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('client_id')).toBe('client-1');
		expect(url.searchParams.get('redirect_uri')).toBe('obsidian://papera-auth');
		expect(url.searchParams.get('state')).toBe('state-1');
		expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('scope')).toBe('sync:read offline_access');
	});

	it('exchanges a code for tokens with the form content type and the resource', async () => {
		vi.mocked(requestUrl).mockResolvedValue(
			answerWith('{"access_token":"access-1","refresh_token":"refresh-1","expires_in":3600}'),
		);

		const tokens = await PaperaOAuthClient.exchangeCode(BASE_URL, {
			clientId: 'client-1',
			code: 'code-1',
			codeVerifier: 'verifier-1',
		});

		const request = sentRequest();
		const body = new URLSearchParams(request.body ?? '');

		expect(request.url).toBe(endpoints.token);
		expect(request.contentType).toBe('application/x-www-form-urlencoded');
		expect(body.get('grant_type')).toBe('authorization_code');
		expect(body.get('code_verifier')).toBe('verifier-1');
		expect(body.get('resource')).toBe('https://papera.dev/api/sync');
		expect(tokens.accessToken).toBe('access-1');
		expect(tokens.refreshToken).toBe('refresh-1');
		expect(tokens.accessTokenExpiresAt).toBeGreaterThan(Date.now());
	});

	it('refreshes tokens with the form content type and the resource', async () => {
		vi.mocked(requestUrl).mockResolvedValue(
			answerWith('{"access_token":"access-2","refresh_token":"refresh-2","expires_in":3600}'),
		);

		await PaperaOAuthClient.refreshTokens(BASE_URL, {
			clientId: 'client-1',
			refreshToken: 'refresh-1',
		});

		const request = sentRequest();
		const body = new URLSearchParams(request.body ?? '');

		expect(request.contentType).toBe('application/x-www-form-urlencoded');
		expect(body.get('grant_type')).toBe('refresh_token');
		expect(body.get('refresh_token')).toBe('refresh-1');
		expect(body.get('resource')).toBe('https://papera.dev/api/sync');
	});

	it('revokes the refresh token with the form content type', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(''));

		await PaperaOAuthClient.revokeRefreshToken(BASE_URL, {
			clientId: 'client-1',
			refreshToken: 'refresh-1',
		});

		const request = sentRequest();
		const body = new URLSearchParams(request.body ?? '');

		expect(request.url).toBe(endpoints.revoke);
		expect(request.contentType).toBe('application/x-www-form-urlencoded');
		expect(body.get('token')).toBe('refresh-1');
		expect(body.get('token_type_hint')).toBe('refresh_token');
	});

	it('raises when the token answer has an empty body', async () => {
		vi.mocked(requestUrl).mockResolvedValue(answerWith(''));

		await expect(
			PaperaOAuthClient.exchangeCode(BASE_URL, {
				clientId: 'client-1',
				code: 'code-1',
				codeVerifier: 'verifier-1',
			}),
		).rejects.toThrow(/access token/);
	});
});
