export type PaperaHoldReason = 'embeddedSyncedNote';

export interface PaperaTranslationContext {
	origin: string;
	reservedRoot: string;
	notePath: string;
	bodyStart: number;
}

export interface PaperaTranslation {
	body: string;
	heldBack: PaperaHoldReason[];
}
