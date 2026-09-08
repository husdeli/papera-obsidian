export type PaperaLinkTarget = 'contentUnit' | 'project' | 'attachment';

export interface PaperaAddress {
	target: PaperaLinkTarget;
	id: string;
	fragment?: string;
}

const PREFIX_BY_TARGET: Record<PaperaLinkTarget, string> = {
	contentUnit: 'n',
	project: 'p',
	attachment: 'a',
};

const PATH_SEGMENT_COUNT = 2;

function parsedUrl(url: string): URL | undefined {
	try {
		return new URL(url);
	} catch {
		return undefined;
	}
}

function decodedComponent(text: string): string | undefined {
	try {
		return decodeURIComponent(text);
	} catch {
		return undefined;
	}
}

function targetOf(prefix: string): PaperaLinkTarget | undefined {
	if (prefix === PREFIX_BY_TARGET.contentUnit) {
		return 'contentUnit';
	}

	if (prefix === PREFIX_BY_TARGET.project) {
		return 'project';
	}

	return prefix === PREFIX_BY_TARGET.attachment ? 'attachment' : undefined;
}

function fragmentOf(url: URL): string | undefined {
	const written = url.hash.slice(1);

	return written === '' ? undefined : decodedComponent(written);
}

export const paperaLinkAddress = {
	read(origin: string, url: string): PaperaAddress | undefined {
		const address = parsedUrl(url);
		const signedInTo = parsedUrl(origin);

		if (address === undefined || signedInTo === undefined) {
			return undefined;
		}

		if (address.origin !== signedInTo.origin || address.search !== '') {
			return undefined;
		}

		const segments = address.pathname.split('/').slice(1);
		const [prefix, id] = segments;

		if (segments.length !== PATH_SEGMENT_COUNT || prefix === undefined || id === undefined) {
			return undefined;
		}

		const target = targetOf(prefix);
		const identity = decodedComponent(id);

		if (target === undefined || identity === undefined || identity === '') {
			return undefined;
		}

		return { target, id: identity, fragment: fragmentOf(address) };
	},

	write(origin: string, address: PaperaAddress): string | undefined {
		const signedInTo = parsedUrl(origin);

		if (signedInTo === undefined) {
			return undefined;
		}

		const url = new URL(signedInTo.origin);

		url.pathname = `/${PREFIX_BY_TARGET[address.target]}/${encodeURIComponent(address.id)}`;

		if (address.fragment !== undefined && address.fragment !== '') {
			url.hash = address.fragment;
		}

		return url.toString();
	},
};
