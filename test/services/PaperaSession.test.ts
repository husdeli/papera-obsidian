import type { ObsidianProtocolData, Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaHttpError } from '../../src/models/PaperaHttpError';
import type { PaperaSettings } from '../../src/models/paperaSettings';
import { PaperaSession } from '../../src/services/PaperaSession';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';

const oauthClient = vi.hoisted(() => ({
	registerClient: vi.fn(),
	authorizationUrl: vi.fn(),
	exchangeCode: vi.fn(),
	refreshTokens: vi.fn(),
	revokeRefreshToken: vi.fn(),
}));

vi.mock('../../src/services/PaperaOAuthClient', () => ({ PaperaOAuthClient: oauthClient }));

const vaultIndex = vi.hoisted(() => ({
	accountId: vi.fn((): string | undefined => undefined),
	recordAccount: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/services/PaperaVaultIndex', () => ({ PaperaVaultIndex: vaultIndex }));

vi.mock('../../src/services/PaperaPkce', () => ({
	PaperaPkce: {
		createCodeVerifier: vi.fn(() => 'verifier-1'),
		createState: vi.fn(() => 'state-1'),
		createCodeChallenge: vi.fn(() => Promise.resolve('challenge-1')),
	},
}));

const BASE_URL = 'https://papera.dev';
const AN_HOUR_MS = 3_600_000;

const saveEvents: string[] = [];

function accessTokenFor(accountId: string): string {
	const claims = btoa(JSON.stringify({ sub: accountId }))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	return `header.${claims}.signature`;
}

function pluginStub() {
	const plugin = {
		loadData: vi.fn(),
		saveData: vi.fn((settings: unknown) => {
			saveEvents.push(`save:${String((settings as PaperaSettings).refreshToken)}`);

			return Promise.resolve();
		}),
	};

	return { plugin, asPlugin: plugin as unknown as Plugin };
}

async function signedInWith(saved: Partial<PaperaSettings>) {
	const { plugin, asPlugin } = pluginStub();

	plugin.loadData.mockResolvedValue({ baseUrl: BASE_URL, ...saved });
	await PaperaSettingsStore.load(asPlugin);

	return { plugin, asPlugin };
}

function forgetInFlightRefresh(): void {
	(PaperaSession as unknown as { refreshInFlight: Promise<string> | undefined }).refreshInFlight =
		undefined;
}

function callbackOf(params: Record<string, string>): ObsidianProtocolData {
	return { action: 'papera-auth', ...params };
}

describe('PaperaSession', () => {
	beforeEach(() => {
		forgetInFlightRefresh();
		vaultIndex.accountId.mockReset().mockReturnValue(undefined);
		vaultIndex.recordAccount.mockReset().mockResolvedValue(undefined);
		saveEvents.length = 0;
		for (const exchange of Object.values(oauthClient)) {
			exchange.mockReset();
		}
	});

	describe('the access token', () => {
		it('returns the stored access token while it is outside the skew', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			await expect(PaperaSession.accessToken(asPlugin)).resolves.toBe('access-1');
			expect(oauthClient.refreshTokens).not.toHaveBeenCalled();
		});

		it('refreshes the access token once it is inside the skew', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() + 1_000,
			});

			oauthClient.refreshTokens.mockResolvedValue({
				accessToken: 'access-2',
				refreshToken: 'refresh-2',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			await expect(PaperaSession.accessToken(asPlugin)).resolves.toBe('access-2');
		});

		it('runs one refresh for ten concurrent callers', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() - 1_000,
			});

			oauthClient.refreshTokens.mockResolvedValue({
				accessToken: 'access-2',
				refreshToken: 'refresh-2',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			const tokens = await Promise.all(
				Array.from({ length: 10 }, () => PaperaSession.accessToken(asPlugin)),
			);

			expect(tokens).toEqual(Array.from({ length: 10 }, () => 'access-2'));
			expect(oauthClient.refreshTokens).toHaveBeenCalledTimes(1);
		});

		it('saves the rotated refresh token before it returns the access token', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() - 1_000,
			});

			oauthClient.refreshTokens.mockResolvedValue({
				accessToken: 'access-2',
				refreshToken: 'refresh-2',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			saveEvents.length = 0;
			saveEvents.push(`return:${await PaperaSession.accessToken(asPlugin)}`);

			expect(saveEvents).toEqual(['save:refresh-2', 'return:access-2']);
		});

		it('signs the vault out when Papera refuses the refresh', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() - 1_000,
				accountId: 'account-1',
			});

			oauthClient.refreshTokens.mockRejectedValue(
				new PaperaHttpError(400, '{"error":"invalid_grant"}'),
			);

			await expect(PaperaSession.accessToken(asPlugin)).rejects.toBeInstanceOf(
				PaperaHttpError,
			);
			expect(PaperaSettingsStore.current()).toMatchObject({
				accessToken: undefined,
				refreshToken: undefined,
				accessTokenExpiresAt: undefined,
				accountId: undefined,
			});
		});

		it('keeps the tokens when the refresh meets a server error', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() - 1_000,
			});

			oauthClient.refreshTokens.mockRejectedValue(
				new PaperaHttpError(500, 'Internal Server Error'),
			);

			await expect(PaperaSession.accessToken(asPlugin)).rejects.toBeInstanceOf(
				PaperaHttpError,
			);
			expect(PaperaSettingsStore.current().refreshToken).toBe('refresh-1');
		});

		it('keeps the tokens when the refresh meets a transport failure', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() - 1_000,
			});

			oauthClient.refreshTokens.mockRejectedValue(
				new PaperaHttpError(0, 'The request could not be sent.'),
			);

			await expect(PaperaSession.accessToken(asPlugin)).rejects.toBeInstanceOf(
				PaperaHttpError,
			);
			expect(PaperaSettingsStore.current().accessToken).toBe('access-1');
		});
	});

	describe('the sign-in', () => {
		it('registers a client and saves the pending request before it opens the browser', async () => {
			const { asPlugin } = await signedInWith({});
			const openedAfterSave: string[] = [];

			oauthClient.registerClient.mockResolvedValue('client-1');
			oauthClient.authorizationUrl.mockResolvedValue(
				'https://papera.dev/oauth2/authorize?state=state-1',
			);

			await PaperaSession.startSignIn(asPlugin, (url) => {
				openedAfterSave.push(url);
				openedAfterSave.push(String(PaperaSettingsStore.current().pendingSignIn?.state));
			});

			expect(oauthClient.registerClient).toHaveBeenCalledWith(BASE_URL);
			expect(openedAfterSave).toEqual([
				'https://papera.dev/oauth2/authorize?state=state-1',
				'state-1',
			]);
			expect(oauthClient.authorizationUrl).toHaveBeenCalledWith(BASE_URL, {
				clientId: 'client-1',
				state: 'state-1',
				codeChallenge: 'challenge-1',
			});
		});

		it('refuses a callback whose state does not match, and clears the pending request', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now(),
				},
			});

			await expect(
				PaperaSession.completeSignIn(
					asPlugin,
					callbackOf({ code: 'code-1', state: 'state-2' }),
				),
			).rejects.toThrow(/does not match/);
			expect(PaperaSettingsStore.current().pendingSignIn).toBeUndefined();
			expect(oauthClient.exchangeCode).not.toHaveBeenCalled();
		});

		it('refuses a callback with no pending request', async () => {
			const { asPlugin } = await signedInWith({ clientId: 'client-1' });

			await expect(
				PaperaSession.completeSignIn(
					asPlugin,
					callbackOf({ code: 'code-1', state: 'state-1' }),
				),
			).rejects.toThrow(/No Papera sign-in/);
		});

		it('refuses a pending request that is past its lifetime', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now() - AN_HOUR_MS,
				},
			});

			await expect(
				PaperaSession.completeSignIn(
					asPlugin,
					callbackOf({ code: 'code-1', state: 'state-1' }),
				),
			).rejects.toThrow(/expired/);
		});

		it('refuses a callback that carries an error', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now(),
				},
			});

			await expect(
				PaperaSession.completeSignIn(asPlugin, callbackOf({ error: 'access_denied' })),
			).rejects.toThrow(/access_denied/);
		});

		it('stores the tokens and the account of a first sign-in', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now(),
				},
			});

			oauthClient.exchangeCode.mockResolvedValue({
				accessToken: accessTokenFor('account-1'),
				refreshToken: 'refresh-1',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			await PaperaSession.completeSignIn(
				asPlugin,
				callbackOf({ code: 'code-1', state: 'state-1' }),
			);

			expect(PaperaSettingsStore.current()).toMatchObject({
				accessToken: accessTokenFor('account-1'),
				refreshToken: 'refresh-1',
				accountId: 'account-1',
			});
			expect(vaultIndex.recordAccount).toHaveBeenCalledWith(asPlugin, 'account-1');
		});

		it('refuses a second Papera account against the account file', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now(),
				},
			});

			vaultIndex.accountId.mockReturnValue('account-1');
			oauthClient.exchangeCode.mockResolvedValue({
				accessToken: accessTokenFor('account-2'),
				refreshToken: 'refresh-2',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			await expect(
				PaperaSession.completeSignIn(
					asPlugin,
					callbackOf({ code: 'code-1', state: 'state-1' }),
				),
			).rejects.toThrow(/another Papera account/);

			expect(vaultIndex.recordAccount).not.toHaveBeenCalled();
			expect(PaperaSettingsStore.current().accessToken).toBeUndefined();
		});

		it('refuses a second Papera account and revokes the refresh token it received', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: accessTokenFor('account-1'),
				refreshToken: 'refresh-1',
				accountId: 'account-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now(),
				},
			});

			oauthClient.exchangeCode.mockResolvedValue({
				accessToken: accessTokenFor('account-2'),
				refreshToken: 'refresh-2',
				accessTokenExpiresAt: Date.now() + AN_HOUR_MS,
			});

			await expect(
				PaperaSession.completeSignIn(
					asPlugin,
					callbackOf({ code: 'code-1', state: 'state-1' }),
				),
			).rejects.toThrow(/another Papera account/);

			expect(oauthClient.revokeRefreshToken).toHaveBeenCalledWith(BASE_URL, {
				clientId: 'client-1',
				refreshToken: 'refresh-2',
			});
			expect(PaperaSettingsStore.current()).toMatchObject({
				accessToken: accessTokenFor('account-1'),
				refreshToken: 'refresh-1',
				accountId: 'account-1',
			});
		});

		it('clears the stored client id when Papera does not know the client', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				pendingSignIn: {
					state: 'state-1',
					codeVerifier: 'verifier-1',
					createdAt: Date.now(),
				},
			});

			oauthClient.exchangeCode.mockRejectedValue(
				new PaperaHttpError(401, '{"error":"invalid_client"}'),
			);

			await expect(
				PaperaSession.completeSignIn(
					asPlugin,
					callbackOf({ code: 'code-1', state: 'state-1' }),
				),
			).rejects.toBeInstanceOf(PaperaHttpError);
			expect(PaperaSettingsStore.current().clientId).toBeUndefined();
		});
	});

	describe('the sign-out', () => {
		it('clears both tokens after a failed revocation', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accountId: 'account-1',
			});

			oauthClient.revokeRefreshToken.mockRejectedValue(
				new PaperaHttpError(500, 'Internal Server Error'),
			);

			await PaperaSession.signOut(asPlugin);

			expect(PaperaSettingsStore.current()).toMatchObject({
				accessToken: undefined,
				refreshToken: undefined,
				accessTokenExpiresAt: undefined,
				accountId: undefined,
			});
		});

		it('leaves the account record in place', async () => {
			const { asPlugin } = await signedInWith({
				clientId: 'client-1',
				accessToken: 'access-1',
				refreshToken: 'refresh-1',
				accountId: 'account-1',
			});

			vaultIndex.accountId.mockReturnValue('account-1');
			oauthClient.revokeRefreshToken.mockResolvedValue(undefined);

			await PaperaSession.signOut(asPlugin);

			expect(vaultIndex.recordAccount).not.toHaveBeenCalled();
			expect(vaultIndex.accountId()).toBe('account-1');
		});
	});
});
