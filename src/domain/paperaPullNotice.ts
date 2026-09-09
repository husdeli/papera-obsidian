import type { PaperaProjectReport, PaperaPullResult } from '../models/paperaPullResult';

function nameOf(report: PaperaProjectReport): string {
	return report.name === '' ? report.id : report.name;
}

function counted(count: number, one: string, many: string): string | undefined {
	if (count === 0) {
		return undefined;
	}

	return `${count} ${count === 1 ? one : many}`;
}

function syncedSentence(result: PaperaPullResult): string {
	const synced = result.projects.filter((report) => report.outcome === 'synced');

	if (synced.length === 0) {
		return 'No project synced.';
	}

	return `Synced ${synced.map(nameOf).join(', ')}.`;
}

function changeSentence(result: PaperaPullResult): string {
	const changes = [
		counted(result.notesWritten, 'note written', 'notes written'),
		counted(result.notesRenamed, 'note renamed', 'notes renamed'),
		counted(result.notesRemoved, 'note removed', 'notes removed'),
	].filter((change) => change !== undefined);

	return changes.length === 0 ? 'No note changed.' : `${changes.join(', ')}.`;
}

function failureSentences(result: PaperaPullResult): string[] {
	return result.projects
		.filter((report) => report.outcome !== 'synced')
		.map((report) => `${nameOf(report)} did not sync, because ${report.reason ?? 'it failed'}.`);
}

function unreadSentence(result: PaperaPullResult): string | undefined {
	const unread = counted(
		result.projects.reduce((total, report) => total + report.failedNotes, 0),
		'note could not be read',
		'notes could not be read',
	);

	return unread === undefined ? undefined : `${unread}.`;
}

function unansweredSentence(result: PaperaPullResult): string | undefined {
	if (result.unansweredNotes === 0) {
		return undefined;
	}

	if (result.unansweredNotes === 1) {
		return 'One note in the Papera folder belongs to no project this account syncs, so the pull left it alone.';
	}

	return `${result.unansweredNotes} notes in the Papera folder belong to no project this account syncs, so the pull left them alone.`;
}

export const paperaPullNotice = {
	of(result: PaperaPullResult): string {
		return [
			syncedSentence(result),
			changeSentence(result),
			...failureSentences(result),
			unreadSentence(result),
			unansweredSentence(result),
		]
			.filter((sentence) => sentence !== undefined)
			.join(' ');
	},
};
