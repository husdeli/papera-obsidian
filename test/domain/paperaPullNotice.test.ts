import { describe, expect, it } from 'vitest';
import { paperaPullNotice } from '../../src/domain/paperaPullNotice';
import type { PaperaProjectReport, PaperaPullResult } from '../../src/models/paperaPullResult';

function report(fields: Partial<PaperaProjectReport>): PaperaProjectReport {
	return { id: 'project-1', name: 'Acme', outcome: 'synced', failedNotes: 0, ...fields };
}

function resultOf(fields: Partial<PaperaPullResult>): PaperaPullResult {
	return {
		projects: [],
		notesWritten: 0,
		notesRenamed: 0,
		notesRemoved: 0,
		unansweredNotes: 0,
		...fields,
	};
}

describe('paperaPullNotice', () => {
	it('names the projects that synced and the notes that changed', () => {
		expect(
			paperaPullNotice.of(
				resultOf({
					projects: [report({}), report({ id: 'project-2', name: 'Ledger' })],
					notesWritten: 12,
					notesRenamed: 1,
				}),
			),
		).toBe('Synced Acme, Ledger. 12 notes written, 1 note renamed.');
	});

	it('says plainly that nothing changed', () => {
		expect(paperaPullNotice.of(resultOf({ projects: [report({})] }))).toBe(
			'Synced Acme. No note changed.',
		);
	});

	it('names a project that did not sync, and why', () => {
		expect(
			paperaPullNotice.of(
				resultOf({
					projects: [
						report({}),
						report({
							id: 'project-2',
							name: 'Ledger',
							outcome: 'dropped',
							reason: 'this account no longer has access to it',
						}),
					],
					notesWritten: 1,
				}),
			),
		).toBe(
			'Synced Acme. 1 note written. Ledger did not sync, because this account no longer has access to it.',
		);
	});

	it('says that no project synced', () => {
		expect(
			paperaPullNotice.of(
				resultOf({ projects: [report({ outcome: 'failed', reason: 'the connection failed' })] }),
			),
		).toBe('No project synced. No note changed. Acme did not sync, because the connection failed.');
	});

	it('counts the notes it could not read', () => {
		expect(
			paperaPullNotice.of(
				resultOf({ projects: [report({ failedNotes: 2 })], notesWritten: 3 }),
			),
		).toBe('Synced Acme. 3 notes written. 2 notes could not be read.');
	});

	it('tells the person about a note that belongs to no synced project', () => {
		expect(
			paperaPullNotice.of(resultOf({ projects: [report({})], unansweredNotes: 1 })),
		).toBe(
			'Synced Acme. No note changed. One note in the Papera folder belongs to no project this account syncs, so the pull left it alone.',
		);
	});

	it('tells the person about several notes that belong to no synced project', () => {
		expect(
			paperaPullNotice.of(resultOf({ projects: [report({})], unansweredNotes: 3 })),
		).toBe(
			'Synced Acme. No note changed. 3 notes in the Papera folder belong to no project this account syncs, so the pull left them alone.',
		);
	});

	it('names a project by its id when the listing gave it no name', () => {
		expect(paperaPullNotice.of(resultOf({ projects: [report({ name: '' })] }))).toBe(
			'Synced project-1. No note changed.',
		);
	});
});
