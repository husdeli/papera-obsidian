// TODO: confirm the origin in PO-003, which reads it for OAuth discovery.
const PAPERA_ORIGIN = 'https://papera.app';

export const paperaConfig = {
	origin: PAPERA_ORIGIN,
	defaultSettings: {
		baseUrl: PAPERA_ORIGIN,
	},
} as const;
