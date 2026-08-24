const RANDOM_BYTE_LENGTH = 32;

export class PaperaPkce {
	static createCodeVerifier(): string {
		return PaperaPkce.randomBase64Url();
	}

	static createState(): string {
		return PaperaPkce.randomBase64Url();
	}

	static async createCodeChallenge(codeVerifier: string): Promise<string> {
		const verifierBytes = new TextEncoder().encode(codeVerifier);
		const digest = await crypto.subtle.digest('SHA-256', verifierBytes);

		return PaperaPkce.toBase64Url(new Uint8Array(digest));
	}

	private static randomBase64Url(): string {
		return PaperaPkce.toBase64Url(crypto.getRandomValues(new Uint8Array(RANDOM_BYTE_LENGTH)));
	}

	private static toBase64Url(bytes: Uint8Array): string {
		let binary = '';

		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}

		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}
}
