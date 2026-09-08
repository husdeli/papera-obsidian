import type { PaperaLinkResolver } from '../models/paperaLinkResolver';
import type { PaperaTranslation, PaperaTranslationContext } from '../models/paperaTranslation';
import { type PaperaAddress, paperaLinkAddress } from './paperaLinkAddress';
import {
	type PaperaLinkSpan,
	type PaperaMarkdownSpan,
	type PaperaSpanEdit,
	paperaMarkdownSpans,
} from './paperaMarkdownSpans';
import { paperaWikilink } from './paperaWikilink';

function contentUnitAlias(
	displayText: string,
	address: PaperaAddress,
	resolver: PaperaLinkResolver,
	path: string,
): string {
	if (displayText !== '') {
		return displayText;
	}

	return resolver.titleOf(address.id) ?? paperaWikilink.noteNameOf(path);
}

function contentUnitLink(
	displayText: string,
	address: PaperaAddress,
	resolver: PaperaLinkResolver,
): string | undefined {
	const path = resolver.vaultPathOf(address.id);

	if (path === undefined) {
		return undefined;
	}

	return paperaWikilink.write({
		target: path,
		alias: contentUnitAlias(displayText, address, resolver, path),
		heading: address.fragment,
	});
}

function attachmentLink(
	span: PaperaLinkSpan,
	displayText: string,
	address: PaperaAddress,
	resolver: PaperaLinkResolver,
): string | undefined {
	const path = resolver.attachmentPathOf(address.id);

	if (path === undefined) {
		return undefined;
	}

	if (span.kind === 'image') {
		return paperaWikilink.write({
			target: path,
			alias: displayText === '' ? undefined : displayText,
			embed: true,
		});
	}

	return paperaWikilink.write({
		target: path,
		alias: displayText === '' ? paperaWikilink.noteNameOf(path) : displayText,
	});
}

function translatedSpan(
	span: PaperaMarkdownSpan,
	context: PaperaTranslationContext,
	resolver: PaperaLinkResolver,
): string | undefined {
	if (span.kind === 'wikilink' || paperaWikilink.isAutolink(span.source)) {
		return undefined;
	}

	const address = paperaLinkAddress.read(context.origin, span.url);

	if (address === undefined || span.text === undefined) {
		return undefined;
	}

	if (address.target === 'contentUnit') {
		return contentUnitLink(span.text, address, resolver);
	}

	return address.target === 'attachment'
		? attachmentLink(span, span.text, address, resolver)
		: undefined;
}

export const paperaLinkToWikilink = {
	translate(
		body: string,
		context: PaperaTranslationContext,
		resolver: PaperaLinkResolver,
	): PaperaTranslation {
		const edits: PaperaSpanEdit[] = [];

		for (const span of paperaMarkdownSpans.of(body, context.bodyStart)) {
			const text = translatedSpan(span, context, resolver);

			if (text !== undefined) {
				edits.push({ start: span.start, end: span.end, text });
			}
		}

		return { body: paperaMarkdownSpans.spliced(body, edits), heldBack: [] };
	},
};
