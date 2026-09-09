import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paperaConfig } from '../../src/config/papera.config';
import { PaperaHttpError } from '../../src/models/PaperaHttpError';
import type { PaperaProjectContents, PaperaProject } from '../../src/models/paperaProject';
import type { PaperaPullResult } from '../../src/models/paperaPullResult';
import { PaperaPull } from '../../src/services/PaperaPull';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';
import type { PaperaVaultNote, PaperaVaultNoteContents } from '../../src/services/PaperaVault';
import { PaperaVaultMap } from '../../src/services/PaperaVaultMap';

const api = vi.hoisted(() => ({
	projects: vi.fn(),
	contentsOf: vi.fn(),
	bodyOf: vi.fn(),
}));

vi.mock('../../src/services/PaperaSyncApi', () => ({ PaperaSyncApi: api }));

const vault = vi.hoisted(() => ({
	reservedRoot: vi.fn(() => 'Papera'),
	createFolder: vi.fn<(plugin: Plugin, path: string) => Promise<void>>(),
	writeNote: vi.fn<
		(plugin: Plugin, path: string, contents: PaperaVaultNoteContents) => Promise<void>
	>(),
	renamePath: vi.fn<(plugin: Plugin, fromPath: string, toPath: string) => Promise<void>>(),
	removeNote: vi.fn<(plugin: Plugin, path: string) => Promise<void>>(),
	markdownNotes: vi.fn<(plugin: Plugin) => Promise<PaperaVaultNote[]>>(),
	linkTargetPath: vi.fn((): string | undefined => undefined),
}));

vi.mock('../../src/services/PaperaVault', () => ({ PaperaVault: vault }));

const session = vi.hoisted(() => ({
	isSignedIn: vi.fn(() => true),
	accountId: vi.fn((): string | undefined => 'account-1'),
}));

vi.mock('../../src/services/PaperaSession', () => ({ PaperaSession: session }));

const vaultIndex = vi.hoisted(() => ({
	accountId: vi.fn((): string | undefined => undefined),
	recordAccount: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/services/PaperaVaultIndex', () => ({ PaperaVaultIndex: vaultIndex }));

const timers = vi.hoisted(() => ({
	setTimeout: vi.fn((run: () => void) => {
		run();

		return 0;
	}),
}));

vi.stubGlobal('window', timers);

const plugin = {} as Plugin;
const ACME: PaperaProject = { id: 'project-1', name: 'Acme' };
const LEDGER: PaperaProject = { id: 'project-2', name: 'Ledger' };
const KICKOFF_PATH = 'Papera/Acme/Research/Kickoff notes.md';
const AGENDA_PATH = 'Papera/Acme/Research/Agenda.md';

function contents(
	units: { id: string; title: string; revision?: number; lastChangedAt?: string }[],
): PaperaProjectContents {
	return {
		workflows: [{ id: 'workflow-1', name: 'Research' }],
		contentUnits: units.map((unit) => ({ ...unit, workflowId: 'workflow-1' })),
	};
}

function forgetMap(): void {
	const internals = PaperaVaultMap as unknown as {
		owned: Map<string, unknown>;
		ownedIds: Map<string, string>;
		building: Promise<void> | undefined;
		built: unknown;
	};

	internals.owned = new Map();
	internals.ownedIds = new Map();
	internals.building = undefined;
	internals.built = undefined;
}

function forgetPull(): void {
	const internals = PaperaPull as unknown as {
		running: Promise<PaperaPullResult> | undefined;
		owned: PaperaPullResult | undefined;
	};

	internals.running = undefined;
	internals.owned = undefined;
}

async function loadSettings(saved: Record<string, unknown> = {}): Promise<void> {
	await PaperaSettingsStore.load({
		loadData: vi.fn().mockResolvedValue({ baseUrl: 'https://papera.dev', ...saved }),
		saveData: vi.fn(),
	} as unknown as Plugin);
}

async function mapHolding(notes: PaperaVaultNote[]): Promise<void> {
	forgetMap();
	vault.markdownNotes.mockResolvedValue(notes);

	await PaperaVaultMap.build(plugin);
}

function ancestorsOf(path: string): string[] {
	return path.split('/').map((_segment, depth, segments) => segments.slice(0, depth + 1).join('/'));
}

function writtenNote(path: string): PaperaVaultNoteContents | undefined {
	return vault.writeNote.mock.calls.find((call) => call[1] === path)?.[2];
}

describe('PaperaPull', () => {
	beforeEach(async () => {
		forgetPull();
		timers.setTimeout.mockClear();
		await mapHolding([]);
		await loadSettings();

		api.projects.mockReset().mockResolvedValue([ACME]);
		api.contentsOf.mockReset().mockResolvedValue(contents([]));
		api.bodyOf.mockReset().mockResolvedValue('Body');
		vault.createFolder.mockReset();
		vault.writeNote.mockReset();
		vault.renamePath.mockReset();
		vault.removeNote.mockReset();
		session.isSignedIn.mockReset().mockReturnValue(true);
		session.accountId.mockReset().mockReturnValue('account-1');
		vaultIndex.accountId.mockReset().mockReturnValue(undefined);
		vaultIndex.recordAccount.mockClear();
	});

	describe('a first pull', () => {
		beforeEach(() => {
			api.contentsOf.mockResolvedValue(
				contents([
					{ id: 'unit-1', title: 'Kickoff notes', revision: 7, lastChangedAt: '2026-08-30' },
				]),
			);
		});

		it('creates the project folder, its attachments folder and the workflow folder', async () => {
			await PaperaPull.run(plugin);

			expect(vault.createFolder.mock.calls.map((call) => call[1])).toEqual([
				'Papera/Acme',
				'Papera/Acme/attachments',
				'Papera/Acme/Research',
			]);
		});

		it('writes the note with its identity and the body the API answered', async () => {
			await PaperaPull.run(plugin);

			expect(writtenNote(KICKOFF_PATH)).toEqual({
				id: 'unit-1',
				revision: 7,
				lastChangedAt: '2026-08-30',
				body: 'Body',
			});
		});

		it('records the project, the workflow, the note and its title in the map', async () => {
			await PaperaPull.run(plugin);

			expect(PaperaVaultMap.get('project-1')?.path).toBe('Papera/Acme');
			expect(PaperaVaultMap.get('workflow-1')?.path).toBe('Papera/Acme/Research');
			expect(PaperaVaultMap.get('unit-1')).toEqual({
				path: KICKOFF_PATH,
				revision: 7,
				title: 'Kickoff notes',
			});
		});

		it('reports the project it synced', async () => {
			await expect(PaperaPull.run(plugin)).resolves.toMatchObject({
				projects: [{ id: 'project-1', name: 'Acme', outcome: 'synced', failedNotes: 0 }],
				notesWritten: 1,
				notesRenamed: 0,
				notesRemoved: 0,
				unansweredNotes: 0,
			});
		});

		it('records the signed-in account', async () => {
			await PaperaPull.run(plugin);

			expect(vaultIndex.recordAccount).toHaveBeenCalledWith(plugin, 'account-1');
		});

		it('keeps the result for a later reader', async () => {
			const result = await PaperaPull.run(plugin);

			expect(PaperaPull.lastResult()).toBe(result);
		});
	});

	describe('a second pull', () => {
		beforeEach(async () => {
			api.contentsOf.mockResolvedValue(
				contents([{ id: 'unit-1', title: 'Kickoff notes', revision: 7 }]),
			);
			await mapHolding([
				{ path: KICKOFF_PATH, frontmatter: { papera_id: 'unit-1', papera_rev: 7 } },
			]);
		});

		it('writes no note and no account file when nothing changed', async () => {
			vaultIndex.accountId.mockReturnValue('account-1');

			await PaperaPull.run(plugin);

			expect(vault.writeNote).not.toHaveBeenCalled();
			expect(vault.renamePath).not.toHaveBeenCalled();
			expect(vault.removeNote).not.toHaveBeenCalled();
			expect(vaultIndex.recordAccount).not.toHaveBeenCalled();
			expect(api.bodyOf).not.toHaveBeenCalled();
		});

		it('overwrites the note when the revision changed', async () => {
			api.contentsOf.mockResolvedValue(
				contents([{ id: 'unit-1', title: 'Kickoff notes', revision: 8 }]),
			);

			await PaperaPull.run(plugin);

			expect(writtenNote(KICKOFF_PATH)?.revision).toBe(8);
			expect(PaperaVaultMap.get('unit-1')?.revision).toBe(8);
		});

		it('renames a retitled content unit and writes no other note', async () => {
			api.contentsOf.mockResolvedValue(
				contents([{ id: 'unit-1', title: 'Kickoff plan', revision: 7 }]),
			);

			await PaperaPull.run(plugin);

			expect(vault.renamePath).toHaveBeenCalledTimes(1);
			expect(vault.renamePath).toHaveBeenCalledWith(
				plugin,
				KICKOFF_PATH,
				'Papera/Acme/Research/Kickoff plan.md',
			);
			expect(vault.writeNote).not.toHaveBeenCalled();
			expect(PaperaVaultMap.get('unit-1')?.path).toBe('Papera/Acme/Research/Kickoff plan.md');
		});

		it('removes a note whose content unit Papera no longer holds', async () => {
			await mapHolding([
				{ path: KICKOFF_PATH, frontmatter: { papera_id: 'unit-1', papera_rev: 7 } },
				{ path: AGENDA_PATH, frontmatter: { papera_id: 'unit-2', papera_rev: 1 } },
			]);

			const result = await PaperaPull.run(plugin);

			expect(vault.removeNote).toHaveBeenCalledWith(plugin, AGENDA_PATH);
			expect(PaperaVaultMap.get('unit-2')).toBeUndefined();
			expect(result.notesRemoved).toBe(1);
		});

		it('leaves a note under a folder it cannot place, and reports it', async () => {
			await mapHolding([
				{ path: KICKOFF_PATH, frontmatter: { papera_id: 'unit-1', papera_rev: 7 } },
				{
					path: 'Papera/Someone else/Drafts/Theirs.md',
					frontmatter: { papera_id: 'unit-9', papera_rev: 1 },
				},
			]);

			const result = await PaperaPull.run(plugin);

			expect(vault.removeNote).not.toHaveBeenCalled();
			expect(vault.writeNote).not.toHaveBeenCalled();
			expect(result.unansweredNotes).toBe(1);
			expect(PaperaVaultMap.get('unit-9')?.path).toBe('Papera/Someone else/Drafts/Theirs.md');
		});
	});

	describe('a project folder Papera renamed', () => {
		it('renames the folder before it creates the folders it keeps', async () => {
			const asked: string[] = [];
			const holds = new Set<string>();

			vault.createFolder.mockImplementation((_plugin, path) => {
				asked.push(path);

				for (const ancestor of ancestorsOf(path)) {
					holds.add(ancestor);
				}

				return Promise.resolve();
			});
			vault.renamePath.mockImplementation((_plugin, _fromPath, toPath) =>
				holds.has(toPath)
					? Promise.reject(new Error('Destination file already exists!'))
					: Promise.resolve(),
			);
			api.contentsOf.mockResolvedValue(
				contents([{ id: 'unit-1', title: 'Kickoff notes', revision: 8 }]),
			);
			await mapHolding([
				{
					path: 'Papera/Acme Inc/Research/Kickoff notes.md',
					frontmatter: { papera_id: 'unit-1', papera_rev: 7 },
				},
			]);

			const result = await PaperaPull.run(plugin);

			expect(vault.renamePath).toHaveBeenCalledWith(plugin, 'Papera/Acme Inc', 'Papera/Acme');
			expect(asked).toEqual(['Papera/Acme/attachments', 'Papera/Acme/Research']);
			expect(writtenNote(KICKOFF_PATH)?.revision).toBe(8);
			expect(result.notesWritten).toBe(1);
		});
	});

	describe('the body of a note', () => {
		it('translates a Papera link into a wikilink to the note of the same pull', async () => {
			api.contentsOf.mockResolvedValue(
				contents([
					{ id: 'unit-1', title: 'Agenda', revision: 1 },
					{ id: 'unit-2', title: 'Kickoff notes', revision: 1 },
				]),
			);
			api.bodyOf.mockImplementation((_plugin: Plugin, id: string) =>
				Promise.resolve(
					id === 'unit-1' ? 'See [Kickoff notes](https://papera.dev/n/unit-2).' : 'Body',
				),
			);

			await PaperaPull.run(plugin);

			expect(writtenNote(AGENDA_PATH)?.body).toBe(
				'See [[Papera/Acme/Research/Kickoff notes|Kickoff notes]].',
			);
		});
	});

	describe('a project the pull cannot read', () => {
		it('drops a project that answers not permitted, and syncs the rest', async () => {
			api.projects.mockResolvedValue([ACME, LEDGER]);
			api.contentsOf.mockImplementation((_plugin: Plugin, projectId: string) =>
				projectId === 'project-1'
					? Promise.reject(new PaperaHttpError(403, 'forbidden'))
					: Promise.resolve(contents([{ id: 'unit-3', title: 'Invoices', revision: 1 }])),
			);

			const result = await PaperaPull.run(plugin);

			expect(result.projects).toEqual([
				{
					id: 'project-1',
					name: 'Acme',
					outcome: 'dropped',
					failedNotes: 0,
					reason: 'this account no longer has access to it',
				},
				{ id: 'project-2', name: 'Ledger', outcome: 'synced', failedNotes: 0 },
			]);
			expect(writtenNote('Papera/Ledger/Research/Invoices.md')).toBeDefined();
		});

		it('records a project whose listing failed on the connection', async () => {
			api.contentsOf.mockRejectedValue(new PaperaHttpError(0, 'offline'));

			const result = await PaperaPull.run(plugin);

			expect(result.projects[0]).toMatchObject({
				outcome: 'failed',
				reason: 'the connection failed',
			});
		});

		it('removes no note of a project whose listing failed', async () => {
			await mapHolding([
				{ path: KICKOFF_PATH, frontmatter: { papera_id: 'unit-1', papera_rev: 7 } },
			]);
			api.contentsOf.mockRejectedValue(new PaperaHttpError(500, 'broken'));

			await PaperaPull.run(plugin);

			expect(vault.removeNote).not.toHaveBeenCalled();
		});

		it('syncs only the projects the settings select', async () => {
			await loadSettings({ syncedProjectIds: ['project-2'] });
			api.projects.mockResolvedValue([ACME, LEDGER]);

			const result = await PaperaPull.run(plugin);

			expect(result.projects.map((report) => report.id)).toEqual(['project-2']);
		});

		it('syncs no project when the selection is empty', async () => {
			await loadSettings({ syncedProjectIds: [] });
			api.projects.mockResolvedValue([ACME, LEDGER]);

			const result = await PaperaPull.run(plugin);

			expect(result.projects).toEqual([]);
			expect(vault.createFolder).not.toHaveBeenCalled();
		});
	});

	describe('a body read that fails', () => {
		beforeEach(() => {
			api.contentsOf.mockResolvedValue(
				contents([
					{ id: 'unit-1', title: 'Kickoff notes', revision: 1 },
					{ id: 'unit-2', title: 'Agenda', revision: 1 },
				]),
			);
		});

		it('writes the rest of the project and reports the note that failed', async () => {
			api.bodyOf.mockImplementation((_plugin: Plugin, id: string) =>
				id === 'unit-1'
					? Promise.reject(new PaperaHttpError(0, 'offline'))
					: Promise.resolve('Body'),
			);

			const result = await PaperaPull.run(plugin);

			expect(vault.writeNote).toHaveBeenCalledTimes(1);
			expect(writtenNote(AGENDA_PATH)).toBeDefined();
			expect(result.projects[0]?.failedNotes).toBe(1);
			expect(result.notesWritten).toBe(1);
		});

		it('reads a body a second time, after a wait, when Papera asks for less', async () => {
			api.bodyOf
				.mockRejectedValueOnce(new PaperaHttpError(429, 'slow down'))
				.mockResolvedValue('Body');

			const result = await PaperaPull.run(plugin);

			expect(result.notesWritten).toBe(2);
			expect(api.bodyOf).toHaveBeenCalledTimes(3);
			expect(timers.setTimeout).toHaveBeenCalledWith(
				expect.any(Function),
				paperaConfig.retryDelayMs,
			);
		});

		it('reads a body once when Papera refuses it outright', async () => {
			api.bodyOf.mockRejectedValue(new PaperaHttpError(403, 'forbidden'));

			const result = await PaperaPull.run(plugin);

			expect(api.bodyOf).toHaveBeenCalledTimes(2);
			expect(result.notesWritten).toBe(0);
		});
	});

	describe('a run the pull refuses', () => {
		it('refuses a vault that is not signed in', async () => {
			session.isSignedIn.mockReturnValue(false);

			await expect(PaperaPull.run(plugin)).rejects.toThrow(/not signed in/);
		});

		it('refuses a folder that holds the work of another account', async () => {
			vaultIndex.accountId.mockReturnValue('account-2');

			await expect(PaperaPull.run(plugin)).rejects.toThrow(/another Papera account/);
			expect(vault.writeNote).not.toHaveBeenCalled();
		});
	});

	it('joins a run that is already going rather than starting a second', async () => {
		const [one, other] = await Promise.all([PaperaPull.run(plugin), PaperaPull.run(plugin)]);

		expect(one).toBe(other);
		expect(api.projects).toHaveBeenCalledTimes(1);
	});
});
