import { paperaConfig } from '../config/papera.config';
import { PaperaAuthError } from '../models/PaperaAuthError';
import { PaperaOAuthDiscovery } from './PaperaOAuthDiscovery';
import { paperaHttpClient } from './paperaHttpClient';

const JSON_CONTENT_TYPE = 'application/json';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';
const MILLISECONDS_PER_SECOND = 1000;

interface ClientRegistrationResponse {
	client_id?: unknown;
}

interface TokenResponse {
	access_token?: unknown;
	refresh_token?: unknown;
	expires_in?: unknown;
}

export interface PaperaTokens {
	accessToken: string;
	refreshToken: string | undefined;
	accessTokenExpiresAt: number;
}

export interface PaperaAuthorizationRequest {
	clientId: string;
	state: string;
	codeChallenge: string;
}

export interface PaperaCodeExchange {
	clientId: string;
	code: string;
	codeVerifier: string;
}

export interface PaperaRefreshExchange {
	clientId: string;
	refreshToken: string;
}

export class PaperaOAuthClient {
	static async registerClient(baseUrl: string): Promise<string> {
		const endpoints = await PaperaOAuthDiscovery.endpoints(baseUrl);
		const registration = await paperaHttpClient.requestJson<ClientRegistrationResponse>({
			url: endpoints.register,
			method: 'POST',
			contentType: JSON_CONTENT_TYPE,
			body: JSON.stringify({
				client_name: paperaConfig.clientName,
				redirect_uris: [paperaConfig.redirectUri],
				response_types: ['code'],
				grant_types: ['authorization_code', 'refresh_token'],
				token_endpoint_auth_method: 'none',
				application_type: 'native',
				scope: PaperaOAuthClient.scope(),
			}),
		});

		if (registration === undefined || typeof registration.client_id !== 'string') {
			throw new PaperaAuthError('Papera returned no client id for this vault.');
		}

		return registration.client_id;
	}

	static async authorizationUrl(
		baseUrl: string,
		request: PaperaAuthorizationRequest,
	): Promise<string> {
		const endpoints = await PaperaOAuthDiscovery.endpoints(baseUrl);
		const url = new URL(endpoints.authorize);

		url.search = new URLSearchParams({
			response_type: 'code',
			client_id: request.clientId,
			redirect_uri: paperaConfig.redirectUri,
			scope: PaperaOAuthClient.scope(),
			state: request.state,
			code_challenge: request.codeChallenge,
			code_challenge_method: 'S256',
		}).toString();

		return url.toString();
	}

	static async exchangeCode(baseUrl: string, exchange: PaperaCodeExchange): Promise<PaperaTokens> {
		return PaperaOAuthClient.requestTokens(
			baseUrl,
			new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: exchange.clientId,
				code: exchange.code,
				code_verifier: exchange.codeVerifier,
				redirect_uri: paperaConfig.redirectUri,
				resource: PaperaOAuthClient.resource(baseUrl),
			}),
		);
	}

	static async refreshTokens(
		baseUrl: string,
		exchange: PaperaRefreshExchange,
	): Promise<PaperaTokens> {
		return PaperaOAuthClient.requestTokens(
			baseUrl,
			new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: exchange.clientId,
				refresh_token: exchange.refreshToken,
				resource: PaperaOAuthClient.resource(baseUrl),
			}),
		);
	}

	static async revokeRefreshToken(
		baseUrl: string,
		exchange: PaperaRefreshExchange,
	): Promise<void> {
		const endpoints = await PaperaOAuthDiscovery.endpoints(baseUrl);

		await paperaHttpClient.requestJson({
			url: endpoints.revoke,
			method: 'POST',
			contentType: FORM_CONTENT_TYPE,
			body: new URLSearchParams({
				client_id: exchange.clientId,
				token: exchange.refreshToken,
				token_type_hint: 'refresh_token',
			}).toString(),
		});
	}

	private static async requestTokens(
		baseUrl: string,
		body: URLSearchParams,
	): Promise<PaperaTokens> {
		const endpoints = await PaperaOAuthDiscovery.endpoints(baseUrl);
		const response = await paperaHttpClient.requestJson<TokenResponse>({
			url: endpoints.token,
			method: 'POST',
			contentType: FORM_CONTENT_TYPE,
			body: body.toString(),
		});

		return PaperaOAuthClient.toTokens(response);
	}

	private static toTokens(response: TokenResponse | undefined): PaperaTokens {
		if (response === undefined || typeof response.access_token !== 'string') {
			throw new PaperaAuthError('Papera returned no access token.');
		}

		const lifetimeSeconds =
			typeof response.expires_in === 'number' && Number.isFinite(response.expires_in)
				? response.expires_in
				: 0;

		return {
			accessToken: response.access_token,
			refreshToken:
				typeof response.refresh_token === 'string' ? response.refresh_token : undefined,
			accessTokenExpiresAt: Date.now() + lifetimeSeconds * MILLISECONDS_PER_SECOND,
		};
	}

	private static resource(baseUrl: string): string {
		return `${baseUrl.replace(/\/+$/, '')}${paperaConfig.resourcePath}`;
	}

	private static scope(): string {
		return paperaConfig.scopes.join(' ');
	}
}
