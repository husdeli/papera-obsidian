export interface PaperaPendingSignIn {
	state: string;
	codeVerifier: string;
	createdAt: number;
}

export interface PaperaSettings {
	baseUrl: string;
	clientId?: string;
	accessToken?: string;
	refreshToken?: string;
	accessTokenExpiresAt?: number;
	accountId?: string;
	pendingSignIn?: PaperaPendingSignIn;
}
