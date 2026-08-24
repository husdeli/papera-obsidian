const PAPERA_ORIGIN = 'https://papera.dev';

export const paperaConfig = {
	origin: PAPERA_ORIGIN,
	protocolAction: 'papera-auth',
	redirectUri: 'obsidian://papera-auth',
	scopes: ['sync:read', 'offline_access'],
	resourcePath: '/api/sync',
	clientName: 'Papera for Obsidian',
	accessTokenSkewMs: 60_000,
	pendingSignInLifetimeMs: 600_000,
	defaultSettings: {
		baseUrl: PAPERA_ORIGIN,
	},
} as const;
