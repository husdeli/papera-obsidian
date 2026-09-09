import type { Plugin } from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import { paperaLinkToWikilink } from '../domain/paperaLinkToWikilink';
import {
	type PaperaNoteLayout,
	type PaperaProjectLayout,
	paperaVaultLayout,
} from '../domain/paperaVaultLayout';
import { type PaperaVaultActions, paperaVaultPlan } from '../domain/paperaVaultPlan';
import { PaperaAuthError } from '../models/PaperaAuthError';
import { PaperaHttpError } from '../models/PaperaHttpError';
import type { PaperaListedProject } from '../models/paperaProject';
import type { PaperaProjectReport, PaperaPullResult } from '../models/paperaPullResult';
import type { PaperaVaultEntry } from '../models/paperaVaultEntry';
import { PaperaSession } from './PaperaSession';
import { PaperaSettingsStore } from './PaperaSettingsStore';
import { PaperaSyncApi } from './PaperaSyncApi';
import { PaperaVault } from './PaperaVault';
import { PaperaVaultIndex } from './PaperaVaultIndex';
import { PaperaVaultMap } from './PaperaVaultMap';
import { paperaVaultLinkResolver } from './paperaVaultLinkResolver';

const TRANSPORT_FAILURE_STATUS = 0;
const NOT_PERMITTED_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const TOO_MANY_REQUESTS_STATUS = 429;
const LOWEST_SERVER_ERROR_STATUS = 500;
const BODY_START = 0;

type PaperaProjectReports = Map<string, PaperaProjectReport>;
type PaperaPullCounts = Omit<PaperaPullResult, 'projects'>;

export class PaperaPull {
	private static running: Promise<PaperaPullResult> | undefined;
	private static owned: PaperaPullResult | undefined;

	static run(plugin: Plugin): Promise<PaperaPullResult> {
		PaperaPull.running ??= PaperaPull.pull(plugin).finally(() => {
			PaperaPull.running = undefined;
		});

		return PaperaPull.running;
	}

	static lastResult(): PaperaPullResult | undefined {
		return PaperaPull.owned;
	}

	private static async pull(plugin: Plugin): Promise<PaperaPullResult> {
		PaperaPull.refuseUnlessOneAccount();

		await PaperaVaultMap.ready();

		const reservedRoot = PaperaVault.reservedRoot();
		const reports: PaperaProjectReports = new Map();
		const projects = paperaVaultLayout.of(
			reservedRoot,
			await PaperaPull.listProjects(plugin, reports),
		);
		const known = PaperaVaultMap.entries();
		const actions = paperaVaultPlan.of({ reservedRoot, projects, known });

		PaperaPull.recordLayout(projects, known);

		const counts = await PaperaPull.apply(plugin, actions, reports);

		await PaperaPull.recordAccount(plugin);

		PaperaPull.owned = { projects: [...reports.values()], ...counts };

		return PaperaPull.owned;
	}

	private static async listProjects(
		plugin: Plugin,
		reports: PaperaProjectReports,
	): Promise<PaperaListedProject[]> {
		const selection = PaperaSettingsStore.current().syncedProjectIds;
		const listed: PaperaListedProject[] = [];

		for (const project of await PaperaSyncApi.projects(plugin)) {
			if (selection !== undefined && !selection.includes(project.id)) {
				continue;
			}

			const report: PaperaProjectReport = {
				id: project.id,
				name: project.name,
				outcome: 'synced',
				failedNotes: 0,
			};

			reports.set(project.id, report);

			try {
				listed.push({ project, ...(await PaperaSyncApi.contentsOf(plugin, project.id)) });
			} catch (error) {
				report.outcome = PaperaPull.isDropped(error) ? 'dropped' : 'failed';
				report.reason = PaperaPull.reasonOf(error);
			}
		}

		return listed;
	}

	private static recordLayout(
		projects: PaperaProjectLayout[],
		known: Map<string, PaperaVaultEntry>,
	): void {
		for (const project of projects) {
			PaperaVaultMap.put(project.project.id, { path: project.path });

			for (const workflow of project.workflows) {
				PaperaVaultMap.put(workflow.id, { path: workflow.path });
			}

			for (const note of project.notes) {
				PaperaVaultMap.put(note.contentUnit.id, {
					path: note.path,
					revision: known.get(note.contentUnit.id)?.revision,
					title: note.contentUnit.title,
				});
			}
		}
	}

	private static async apply(
		plugin: Plugin,
		actions: PaperaVaultActions,
		reports: PaperaProjectReports,
	): Promise<PaperaPullCounts> {
		// A folder created at a rename destination first would make Obsidian refuse the rename.
		for (const rename of actions.folderRenames) {
			await PaperaVault.renamePath(plugin, rename.fromPath, rename.toPath);
		}

		for (const folder of actions.folders) {
			await PaperaVault.createFolder(plugin, folder);
		}

		for (const rename of actions.noteRenames) {
			await PaperaVault.renamePath(plugin, rename.fromPath, rename.toPath);
		}

		const notesWritten = await PaperaPull.writeNotes(plugin, actions.writes, reports);

		for (const removal of actions.removals) {
			await PaperaVault.removeNote(plugin, removal.path);
			PaperaVaultMap.forget(removal.contentUnitId);
		}

		return {
			notesWritten,
			notesRenamed: actions.noteRenames.length,
			notesRemoved: actions.removals.length,
			unansweredNotes: actions.unansweredNotes.length,
		};
	}

	private static async writeNotes(
		plugin: Plugin,
		writes: PaperaNoteLayout[],
		reports: PaperaProjectReports,
	): Promise<number> {
		const bodies = await PaperaPull.readBodies(plugin, writes, reports);
		const resolver = paperaVaultLinkResolver.for(plugin);
		const origin = PaperaSettingsStore.current().baseUrl;
		const reservedRoot = PaperaVault.reservedRoot();
		let written = 0;

		for (const write of writes) {
			const body = bodies.get(write.contentUnit.id);

			if (body === undefined) {
				continue;
			}

			const translated = paperaLinkToWikilink.translate(
				body,
				{ origin, reservedRoot, notePath: write.path, bodyStart: BODY_START },
				resolver,
			);

			await PaperaVault.writeNote(plugin, write.path, {
				id: write.contentUnit.id,
				revision: write.contentUnit.revision,
				lastChangedAt: write.contentUnit.lastChangedAt,
				body: translated.body,
			});

			PaperaVaultMap.put(write.contentUnit.id, {
				path: write.path,
				revision: write.contentUnit.revision,
				title: write.contentUnit.title,
			});

			written += 1;
		}

		return written;
	}

	private static async readBodies(
		plugin: Plugin,
		writes: PaperaNoteLayout[],
		reports: PaperaProjectReports,
	): Promise<Map<string, string>> {
		const bodies = new Map<string, string>();
		const queue = [...writes];
		const read = async (): Promise<void> => {
			for (let write = queue.shift(); write !== undefined; write = queue.shift()) {
				const contentUnitId = write.contentUnit.id;

				try {
					bodies.set(contentUnitId, await PaperaPull.bodyOf(plugin, contentUnitId));
				} catch {
					PaperaPull.recordFailedNote(reports, write.projectId);
				}
			}
		};

		await Promise.all(
			Array.from({ length: Math.min(paperaConfig.bodyReadsInFlight, queue.length) }, read),
		);

		return bodies;
	}

	private static async bodyOf(plugin: Plugin, contentUnitId: string): Promise<string> {
		try {
			return await PaperaSyncApi.bodyOf(plugin, contentUnitId);
		} catch (error) {
			if (!PaperaPull.isWorthRetrying(error)) {
				throw error;
			}

			await PaperaPull.pause(paperaConfig.retryDelayMs);

			return PaperaSyncApi.bodyOf(plugin, contentUnitId);
		}
	}

	private static pause(delayMs: number): Promise<void> {
		return new Promise((settle) => {
			window.setTimeout(settle, delayMs);
		});
	}

	private static recordFailedNote(reports: PaperaProjectReports, projectId: string): void {
		const report = reports.get(projectId);

		if (report !== undefined) {
			report.failedNotes += 1;
		}
	}

	private static async recordAccount(plugin: Plugin): Promise<void> {
		const accountId = PaperaSession.accountId();

		if (accountId === undefined || PaperaVaultIndex.accountId() !== undefined) {
			return;
		}

		await PaperaVaultIndex.recordAccount(plugin, accountId);
	}

	private static refuseUnlessOneAccount(): void {
		if (!PaperaSession.isSignedIn()) {
			throw new PaperaAuthError('This vault is not signed in to Papera.');
		}

		const recorded = PaperaVaultIndex.accountId();
		const signedIn = PaperaSession.accountId();

		if (recorded !== undefined && signedIn !== undefined && recorded !== signedIn) {
			throw new PaperaAuthError(
				'The Papera folder holds the work of another Papera account. Sign in again as that account.',
			);
		}
	}

	private static isDropped(error: unknown): boolean {
		return (
			error instanceof PaperaHttpError &&
			(error.status === NOT_PERMITTED_STATUS || error.status === NOT_FOUND_STATUS)
		);
	}

	private static isWorthRetrying(error: unknown): boolean {
		return (
			error instanceof PaperaHttpError &&
			(error.status === TOO_MANY_REQUESTS_STATUS ||
				error.status >= LOWEST_SERVER_ERROR_STATUS)
		);
	}

	private static reasonOf(error: unknown): string {
		if (!(error instanceof PaperaHttpError)) {
			return error instanceof Error ? error.message : 'the project could not be read';
		}

		switch (error.status) {
			case NOT_PERMITTED_STATUS:
				return 'this account no longer has access to it';
			case NOT_FOUND_STATUS:
				return 'it is no longer there';
			case TRANSPORT_FAILURE_STATUS:
				return 'the connection failed';
			default:
				return `Papera answered ${error.status}`;
		}
	}
}
