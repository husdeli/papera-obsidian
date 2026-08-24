import { PaperaAuthError } from '../models/PaperaAuthError';
import { paperaHttpClient } from './paperaHttpClient';

const METADATA_PATH = '/.well-known/oauth-authorization-server';
const REQUIRED_CHALLENGE_METHOD = 'S256';

interface OAuthServerMetadata {
	authorization_endpoint?: unknown;
	token_endpoint?: unknown;
	registration_endpoint?: unknown;
	revocation_endpoint?: unknown;
	code_challenge_methods_supported?: unknown;
}

export interface PaperaOAuthEndpoints {
	authorize: string;
	token: string;
	register: string;
	revoke: string;
}

export class PaperaOAuthDiscovery {
	private static readonly endpointsByBaseUrl = new Map<string, PaperaOAuthEndpoints>();

	static async endpoints(baseUrl: string): Promise<PaperaOAuthEndpoints> {
		const known = PaperaOAuthDiscovery.endpointsByBaseUrl.get(baseUrl);

		if (known !== undefined) {
			return known;
		}

		const metadata = await paperaHttpClient.requestJson<OAuthServerMetadata>({
			url: `${new URL(baseUrl).origin}${METADATA_PATH}`,
		});
		const endpoints = PaperaOAuthDiscovery.toEndpoints(metadata);

		PaperaOAuthDiscovery.endpointsByBaseUrl.set(baseUrl, endpoints);

		return endpoints;
	}

	private static toEndpoints(metadata: OAuthServerMetadata | undefined): PaperaOAuthEndpoints {
		if (metadata === undefined) {
			throw new PaperaAuthError('Papera answered the discovery request with no document.');
		}

		const methods = metadata.code_challenge_methods_supported;

		if (!Array.isArray(methods) || !methods.includes(REQUIRED_CHALLENGE_METHOD)) {
			throw new PaperaAuthError(
				`Papera does not offer the ${REQUIRED_CHALLENGE_METHOD} code challenge method, which this plugin needs.`,
			);
		}

		return {
			authorize: PaperaOAuthDiscovery.asEndpoint(
				metadata.authorization_endpoint,
				'authorization_endpoint',
			),
			token: PaperaOAuthDiscovery.asEndpoint(metadata.token_endpoint, 'token_endpoint'),
			register: PaperaOAuthDiscovery.asEndpoint(
				metadata.registration_endpoint,
				'registration_endpoint',
			),
			revoke: PaperaOAuthDiscovery.asEndpoint(
				metadata.revocation_endpoint,
				'revocation_endpoint',
			),
		};
	}

	private static asEndpoint(value: unknown, field: string): string {
		if (typeof value !== 'string' || value === '') {
			throw new PaperaAuthError(`The Papera discovery document has no ${field}.`);
		}

		return value;
	}
}
