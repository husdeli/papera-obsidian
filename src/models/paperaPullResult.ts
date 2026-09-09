export type PaperaProjectOutcome = 'synced' | 'dropped' | 'failed';

export interface PaperaProjectReport {
	id: string;
	name: string;
	outcome: PaperaProjectOutcome;
	failedNotes: number;
	reason?: string;
}

export interface PaperaPullResult {
	projects: PaperaProjectReport[];
	notesWritten: number;
	notesRenamed: number;
	notesRemoved: number;
	unansweredNotes: number;
}
