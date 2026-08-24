import { describe, expect, it } from 'vitest';
import { PaperaPkce } from '../../src/services/PaperaPkce';

const RFC_7636_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_7636_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('PaperaPkce', () => {
	it('derives the challenge of the RFC 7636 example verifier', async () => {
		await expect(PaperaPkce.createCodeChallenge(RFC_7636_VERIFIER)).resolves.toBe(
			RFC_7636_CHALLENGE,
		);
	});

	it('produces a different verifier on every call', () => {
		expect(PaperaPkce.createCodeVerifier()).not.toBe(PaperaPkce.createCodeVerifier());
	});

	it('produces a verifier of 43 unreserved characters', () => {
		expect(PaperaPkce.createCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]{43}$/);
	});

	it('produces a different state value on every call', () => {
		expect(PaperaPkce.createState()).not.toBe(PaperaPkce.createState());
	});
});
