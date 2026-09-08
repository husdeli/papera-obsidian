import type { PaperaLinkResolver } from '../models/paperaLinkResolver';
import type {
	PaperaHoldReason,
	PaperaTranslation,
	PaperaTranslationContext,
} from '../models/paperaTranslation';
import { paperaLinkAddress } from './paperaLinkAddress';
import {
	type PaperaLinkSpan,
	type PaperaMarkdownSpan,
	type PaperaSpanEdit,
	type PaperaWikilinkSpan,
	paperaMarkdownSpans,
} from './paperaMarkdownSpans';
import { paperaVaultScope } from './paperaVaultScope';
import { paperaWikilink } from './paperaWikilink';

interface PaperaSyncedTarget {
	id: string;
	path: string;
}

interface PaperaSpanTranslation {
	text?: string;
	hold?: PaperaHoldReason;
}

function syncedTarget(
	target: string,
	context: PaperaTranslationContext,
	resolver: PaperaLinkResolver,
): PaperaSyncedTarget | undefined {
	const path = resolver.targetOf(context.notePath, target);

	if (path === undefined || !paperaVaultScope.holds(context.reservedRoot, path)) {
		return undefined;
	}

	const id = resolver.contentUnitIdAt(path);

	return id === undefined ? undefined : { id, path };
}

function paperaLink(
	found: PaperaSyncedTarget,
	displayText: string,
	heading: string | undefined,
	context: PaperaTranslationContext,
): string | undefined {
	const url = paperaLinkAddress.write(context.origin, {
		target: 'contentUnit',
		id: found.id,
		fragment: heading,
	});

	return url === undefined
		? undefined
		: `[${paperaWikilink.escapedDisplayText(displayText)}](${url})`;
}

function fromWikilink(
	span: PaperaWikilinkSpan,
	context: PaperaTranslationContext,
	resolver: PaperaLinkResolver,
): PaperaSpanTranslation | undefined {
	const parts = paperaWikilink.read(span.source);

	if (parts === undefined) {
		return undefined;
	}

	const found = syncedTarget(parts.target, context, resolver);

	if (found === undefined) {
		return undefined;
	}

	if (parts.embed) {
		return { hold: 'embeddedSyncedNote' };
	}

	const displayText =
		parts.alias ?? resolver.titleOf(found.id) ?? paperaWikilink.noteNameOf(found.path);
	const text = paperaLink(found, displayText, parts.heading, context);

	return text === undefined ? undefined : { text };
}

function fromMarkdownLink(
	span: PaperaLinkSpan,
	context: PaperaTranslationContext,
	resolver: PaperaLinkResolver,
): PaperaSpanTranslation | undefined {
	if (span.kind === 'image' || paperaWikilink.isAutolink(span.source)) {
		return undefined;
	}

	const destination = paperaWikilink.readDestination(span.url);
	const found = syncedTarget(destination.target, context, resolver);

	if (found === undefined || span.text === undefined) {
		return undefined;
	}

	const text = paperaLink(found, span.text, destination.heading, context);

	return text === undefined ? undefined : { text };
}

function translatedSpan(
	span: PaperaMarkdownSpan,
	context: PaperaTranslationContext,
	resolver: PaperaLinkResolver,
): PaperaSpanTranslation | undefined {
	return span.kind === 'wikilink'
		? fromWikilink(span, context, resolver)
		: fromMarkdownLink(span, context, resolver);
}

export const paperaWikilinkToLink = {
	translate(
		body: string,
		context: PaperaTranslationContext,
		resolver: PaperaLinkResolver,
	): PaperaTranslation {
		const edits: PaperaSpanEdit[] = [];
		const heldBack: PaperaHoldReason[] = [];

		for (const span of paperaMarkdownSpans.of(body, context.bodyStart)) {
			const translation = translatedSpan(span, context, resolver);

			if (translation === undefined) {
				continue;
			}

			if (translation.hold !== undefined && !heldBack.includes(translation.hold)) {
				heldBack.push(translation.hold);
			}

			if (translation.text !== undefined) {
				edits.push({ start: span.start, end: span.end, text: translation.text });
			}
		}

		return { body: paperaMarkdownSpans.spliced(body, edits), heldBack };
	},
};
