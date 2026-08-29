import type { ObsidianProtocolData, Plugin } from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import { PaperaAuthError } from '../models/PaperaAuthError';
import { PaperaHttpError } from '../models/PaperaHttpError';
import { PaperaOAuthClient, type PaperaTokens } from './PaperaOAuthClient';
import { PaperaPkce } from './PaperaPkce';
import { PaperaSettingsStore } from './PaperaSettingsStore';
import { PaperaVaultIndex } from './PaperaVaultIndex';

const LOWEST_CLIENT_ERROR_STATUS = 400;
const LOWEST_SERVER_ERROR_STATUS = 500;
const UNKNOWN_CLIENT_ERROR = 'invalid_client';
const JWT_CLAIMS_SEGMENT = 1;

export type PaperaBrowserOpener = (url: string) => void;

export class PaperaSession {
	private static refreshInFlight: Promise<string> | undefined;

	static isSignedIn(): boolean {
		return PaperaSettingsStore.current().accessToken !== undefined;
	}

	static accountId(): string | undefined {
		return PaperaSettingsStore.current().accountId;
	}

	static async accessToken(plugin: Plugin): Promise<string> {
		const settings = PaperaSettingsStore.current();

		if (settings.accessToken === undefined) {
			throw new PaperaAuthError('This vault is not signed in to Papera.');
		}

		const remainingMs = (settings.accessTokenExpiresAt ?? 0) - Date.now();

		if (remainingMs > paperaConfig.accessTokenSkewMs) {
			return settings.accessToken;
		}

		return PaperaSession.refreshAccessToken(plugin);
	}

	static async refreshAccessToken(plugin: Plugin): Promise<string> {
		PaperaSession.refreshInFlight ??= PaperaSession.runRefresh(plugin).finally(() => {
			PaperaSession.refreshInFlight = undefined;
		});

		return PaperaSession.refreshInFlight;
	}

	static async startSignIn(plugin: Plugin, openInBrowser: PaperaBrowserOpener): Promise<void> {
		const baseUrl = PaperaSettingsStore.current().baseUrl;
		const clientId = await PaperaSession.clientId(plugin, baseUrl);
		const codeVerifier = PaperaPkce.createCodeVerifier();
		const state = PaperaPkce.createState();
		const codeChallenge = await PaperaPkce.createCodeChallenge(codeVerifier);
		const authorizationUrl = await PaperaOAuthClient.authorizationUrl(baseUrl, {
			clientId,
			state,
			codeChallenge,
		});

		await PaperaSettingsStore.update(plugin, {
			pendingSignIn: { state, codeVerifier, createdAt: Date.now() },
		});

		openInBrowser(authorizationUrl);
	}

	static async completeSignIn(plugin: Plugin, params: ObsidianProtocolData): Promise<void> {
		const pending = PaperaSettingsStore.current().pendingSignIn;

		await PaperaSettingsStore.update(plugin, { pendingSignIn: undefined });

		if (typeof params.error === 'string') {
			throw new PaperaAuthError(`Papera refused the sign-in: ${params.error}.`);
		}

		if (pending === undefined) {
			throw new PaperaAuthError('No Papera sign-in is in progress in this vault.');
		}

		if (Date.now() - pending.createdAt > paperaConfig.pendingSignInLifetimeMs) {
			throw new PaperaAuthError('The Papera sign-in request expired. Start the sign-in again.');
		}

		if (params.state !== pending.state) {
			throw new PaperaAuthError('The Papera sign-in answer does not match this vault.');
		}

		if (typeof params.code !== 'string' || params.code === '') {
			throw new PaperaAuthError('Papera returned no authorization code.');
		}

		await PaperaSession.exchangeAndStore(plugin, params.code, pending.codeVerifier);
	}

	static async signOut(plugin: Plugin): Promise<void> {
		const settings = PaperaSettingsStore.current();

		await PaperaSession.revokeQuietly(
			settings.baseUrl,
			settings.clientId,
			settings.refreshToken,
		);
		await PaperaSession.clearTokens(plugin);
	}

	private static async exchangeAndStore(
		plugin: Plugin,
		code: string,
		codeVerifier: string,
	): Promise<void> {
		const settings = PaperaSettingsStore.current();
		const clientId = settings.clientId;

		if (clientId === undefined) {
			throw new PaperaAuthError('This vault has no Papera client. Start the sign-in again.');
		}

		const tokens = await PaperaSession.exchangeCode(plugin, settings.baseUrl, {
			clientId,
			code,
			codeVerifier,
		});
		const accountId = PaperaSession.accountIdOf(tokens.accessToken);
		const knownAccountId =
			PaperaVaultIndex.accountId() ?? PaperaSettingsStore.current().accountId;

		if (knownAccountId !== undefined && accountId !== undefined && knownAccountId !== accountId) {
			await PaperaSession.revokeQuietly(settings.baseUrl, clientId, tokens.refreshToken);

			throw new PaperaAuthError(
				'This vault already holds the work of another Papera account. Sign in again as that account.',
			);
		}

		await PaperaSession.storeTokens(plugin, tokens, accountId);
	}

	private static async exchangeCode(
		plugin: Plugin,
		baseUrl: string,
		exchange: { clientId: string; code: string; codeVerifier: string },
	): Promise<PaperaTokens> {
		try {
			return await PaperaOAuthClient.exchangeCode(baseUrl, exchange);
		} catch (error) {
			if (PaperaSession.oauthErrorOf(error) === UNKNOWN_CLIENT_ERROR) {
				await PaperaSettingsStore.update(plugin, { clientId: undefined });
			}

			throw error;
		}
	}

	private static async runRefresh(plugin: Plugin): Promise<string> {
		const settings = PaperaSettingsStore.current();
		const { clientId, refreshToken } = settings;

		if (clientId === undefined || refreshToken === undefined) {
			throw new PaperaAuthError('This vault is not signed in to Papera.');
		}

		try {
			const tokens = await PaperaOAuthClient.refreshTokens(settings.baseUrl, {
				clientId,
				refreshToken,
			});

			await PaperaSession.storeTokens(plugin, tokens, undefined);

			return tokens.accessToken;
		} catch (error) {
			if (PaperaSession.isRefusal(error)) {
				await PaperaSession.clearTokens(plugin);
			}

			throw error;
		}
	}

	private static async clientId(plugin: Plugin, baseUrl: string): Promise<string> {
		const known = PaperaSettingsStore.current().clientId;

		if (known !== undefined) {
			return known;
		}

		const registered = await PaperaOAuthClient.registerClient(baseUrl);

		await PaperaSettingsStore.update(plugin, { clientId: registered });

		return registered;
	}

	private static async storeTokens(
		plugin: Plugin,
		tokens: PaperaTokens,
		accountId: string | undefined,
	): Promise<void> {
		await PaperaSettingsStore.update(plugin, {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken ?? PaperaSettingsStore.current().refreshToken,
			accessTokenExpiresAt: tokens.accessTokenExpiresAt,
			accountId: accountId ?? PaperaSettingsStore.current().accountId,
		});

		if (accountId !== undefined) {
			await PaperaVaultIndex.recordAccount(plugin, accountId);
		}
	}

	private static async clearTokens(plugin: Plugin): Promise<void> {
		await PaperaSettingsStore.update(plugin, {
			accessToken: undefined,
			refreshToken: undefined,
			accessTokenExpiresAt: undefined,
			accountId: undefined,
		});
	}

	private static async revokeQuietly(
		baseUrl: string,
		clientId: string | undefined,
		refreshToken: string | undefined,
	): Promise<void> {
		if (clientId === undefined || refreshToken === undefined) {
			return;
		}

		try {
			await PaperaOAuthClient.revokeRefreshToken(baseUrl, { clientId, refreshToken });
		} catch {
			return;
		}
	}

	private static isRefusal(error: unknown): boolean {
		return (
			error instanceof PaperaHttpError &&
			error.status >= LOWEST_CLIENT_ERROR_STATUS &&
			error.status < LOWEST_SERVER_ERROR_STATUS
		);
	}

	private static oauthErrorOf(error: unknown): string | undefined {
		if (!(error instanceof PaperaHttpError)) {
			return undefined;
		}

		try {
			const parsed: unknown = JSON.parse(error.body);
			const code = (parsed as { error?: unknown } | null)?.error;

			return typeof code === 'string' ? code : undefined;
		} catch {
			return undefined;
		}
	}

	// The plugin never verifies this claim, so it serves as a label and never as an authorization decision.
	private static accountIdOf(accessToken: string): string | undefined {
		const claimsSegment = accessToken.split('.')[JWT_CLAIMS_SEGMENT];

		if (claimsSegment === undefined) {
			return undefined;
		}

		try {
			const claims: unknown = JSON.parse(
				atob(claimsSegment.replace(/-/g, '+').replace(/_/g, '/')),
			);
			const subject = (claims as { sub?: unknown } | null)?.sub;

			return typeof subject === 'string' ? subject : undefined;
		} catch {
			return undefined;
		}
	}
}
