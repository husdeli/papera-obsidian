import { describe, expect, it } from 'vitest';
import { paperaVaultLayout } from '../../src/domain/paperaVaultLayout';
import { paperaVaultPlan } from '../../src/domain/paperaVaultPlan';
import type { PaperaListedProject } from '../../src/models/paperaProject';
import type { PaperaVaultEntry } from '../../src/models/paperaVaultEntry';

const ROOT = 'Papera';
const NOTE_PATH = 'Papera/Acme/Research/Kickoff notes.md';

interface FakeUnit {
	id: string;
	workflowId: string;
	title: string;
	revision?: number;
}

function listedProject(
	project: { id: string; name: string },
	workflows: { id: string; name: string }[],
	contentUnits: FakeUnit[] = [],
): PaperaListedProject {
	return { project, workflows, contentUnits };
}

function acmeWith(contentUnits: FakeUnit[]): PaperaListedProject {
	return listedProject(
		{ id: 'project-1', name: 'Acme' },
		[{ id: 'workflow-1', name: 'Research' }],
		contentUnits,
	);
}

function planFor(listed: PaperaListedProject[], known: Record<string, PaperaVaultEntry> = {}) {
	return paperaVaultPlan.of({
		reservedRoot: ROOT,
		projects: paperaVaultLayout.of(ROOT, listed),
		known: new Map(Object.entries(known)),
	});
}

describe('paperaVaultPlan', () => {
	describe('the folders', () => {
		it('creates the project folder, its attachments folder and every workflow folder', () => {
			const actions = planFor([
				listedProject({ id: 'project-1', name: 'Acme' }, [
					{ id: 'workflow-1', name: 'Research' },
				]),
			]);

			expect(actions.folders).toEqual([
				'Papera/Acme',
				'Papera/Acme/attachments',
				'Papera/Acme/Research',
			]);
		});

		it('creates a project folder that inversion cannot identify', () => {
			const actions = planFor([acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'One' }])]);

			expect(actions.folders).toContain('Papera/Acme');
			expect(actions.folderRenames).toEqual([]);
		});

		it('creates no folder it is about to rename into place', () => {
			const actions = planFor([acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'One' }])], {
				'unit-1': { path: 'Papera/Acme Inc/Research/One.md' },
			});

			expect(actions.folderRenames).toEqual([
				{ fromPath: 'Papera/Acme Inc', toPath: 'Papera/Acme' },
			]);
			expect(actions.folders).not.toContain('Papera/Acme');
			expect(actions.folders).toContain('Papera/Acme/attachments');
		});
	});

	describe('the writes', () => {
		it('answers a write for a content unit the vault does not hold', () => {
			const actions = planFor([
				acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes', revision: 7 }]),
			]);

			expect(actions.writes.map((write) => write.path)).toEqual([NOTE_PATH]);
		});

		it('answers no write when the listed revision equals the one the map holds', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes', revision: 7 }])],
				{ 'unit-1': { path: NOTE_PATH, revision: 7 } },
			);

			expect(actions.writes).toEqual([]);
			expect(actions.noteRenames).toEqual([]);
			expect(actions.removals).toEqual([]);
		});

		it('answers a write when the revision changed', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes', revision: 8 }])],
				{ 'unit-1': { path: NOTE_PATH, revision: 7 } },
			);

			expect(actions.writes.map((write) => write.contentUnit.id)).toEqual(['unit-1']);
		});

		it('answers a write when the listing names no revision', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes' }])],
				{ 'unit-1': { path: NOTE_PATH } },
			);

			expect(actions.writes).toHaveLength(1);
		});
	});

	describe('the renames', () => {
		it('renames a content unit that was retitled, and writes no other note', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes', revision: 7 }])],
				{ 'unit-1': { path: 'Papera/Acme/Research/Kick off.md', revision: 7 } },
			);

			expect(actions.noteRenames).toEqual([
				{ fromPath: 'Papera/Acme/Research/Kick off.md', toPath: NOTE_PATH },
			]);
			expect(actions.writes).toEqual([]);
		});

		it('renames the workflow folder after the project folder it sits in', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'One', revision: 1 }])],
				{ 'unit-1': { path: 'Papera/Acme Inc/Studies/One.md', revision: 1 } },
			);

			expect(actions.folderRenames).toEqual([
				{ fromPath: 'Papera/Acme Inc', toPath: 'Papera/Acme' },
				{ fromPath: 'Papera/Acme/Studies', toPath: 'Papera/Acme/Research' },
			]);
			expect(actions.noteRenames).toEqual([]);
		});

		it('keeps the shorter path when one project claims two folders', () => {
			const actions = planFor(
				[
					acmeWith([
						{ id: 'unit-1', workflowId: 'workflow-1', title: 'One', revision: 1 },
						{ id: 'unit-2', workflowId: 'workflow-1', title: 'Two', revision: 1 },
					]),
				],
				{
					'unit-1': { path: 'Papera/Acme Incorporated/Research/One.md', revision: 1 },
					'unit-2': { path: 'Papera/Acme Inc/Research/Two.md', revision: 1 },
				},
			);

			expect(actions.folderRenames[0]).toEqual({
				fromPath: 'Papera/Acme Inc',
				toPath: 'Papera/Acme',
			});
		});
	});

	describe('a note the listing does not answer', () => {
		it('removes it when it sits in a workflow folder inversion assigned', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'One', revision: 1 }])],
				{
					'unit-1': { path: 'Papera/Acme/Research/One.md', revision: 1 },
					'unit-2': { path: 'Papera/Acme/Research/Gone.md', revision: 1 },
				},
			);

			expect(actions.removals).toEqual([
				{ contentUnitId: 'unit-2', path: 'Papera/Acme/Research/Gone.md' },
			]);
			expect(actions.unansweredNotes).toEqual([]);
		});

		it('removes the last note of a workflow folder that holds nothing else', () => {
			const actions = planFor(
				[
					listedProject(
						{ id: 'project-1', name: 'Acme' },
						[
							{ id: 'workflow-1', name: 'Research' },
							{ id: 'workflow-2', name: 'Review' },
						],
						[{ id: 'unit-1', workflowId: 'workflow-1', title: 'One', revision: 1 }],
					),
				],
				{
					'unit-1': { path: 'Papera/Acme/Research/One.md', revision: 1 },
					'unit-2': { path: 'Papera/Acme/Review/Gone.md', revision: 1 },
				},
			);

			expect(actions.removals).toEqual([
				{ contentUnitId: 'unit-2', path: 'Papera/Acme/Review/Gone.md' },
			]);
			expect(actions.unansweredNotes).toEqual([]);
		});

		it('reports it and touches nothing when inversion assigned no folder', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'One', revision: 1 }])],
				{
					'unit-1': { path: 'Papera/Acme/Research/One.md', revision: 1 },
					'unit-9': { path: 'Papera/Someone else/Drafts/Theirs.md', revision: 1 },
				},
			);

			expect(actions.unansweredNotes).toEqual(['Papera/Someone else/Drafts/Theirs.md']);
			expect(actions.removals).toEqual([]);
			expect(actions.noteRenames).toEqual([]);
			expect(actions.writes).toEqual([]);
		});

		it('removes nothing of a project whose contents listing failed', () => {
			const actions = planFor([listedProject({ id: 'project-2', name: 'Ledger' }, [])], {
				'unit-1': { path: 'Papera/Acme/Research/One.md', revision: 1 },
			});

			expect(actions.removals).toEqual([]);
			expect(actions.unansweredNotes).toEqual(['Papera/Acme/Research/One.md']);
		});

		it('follows the folder rename that moved it', () => {
			const actions = planFor(
				[acmeWith([{ id: 'unit-1', workflowId: 'workflow-1', title: 'One', revision: 1 }])],
				{
					'unit-1': { path: 'Papera/Acme Inc/Research/One.md', revision: 1 },
					'unit-2': { path: 'Papera/Acme Inc/Research/Gone.md', revision: 1 },
				},
			);

			expect(actions.removals).toEqual([
				{ contentUnitId: 'unit-2', path: 'Papera/Acme/Research/Gone.md' },
			]);
		});

		it('ignores a map entry that is a project or a workflow folder', () => {
			const actions = planFor([acmeWith([])], {
				'project-1': { path: 'Papera/Acme' },
				'workflow-1': { path: 'Papera/Acme/Research' },
			});

			expect(actions.removals).toEqual([]);
			expect(actions.unansweredNotes).toEqual([]);
		});
	});
});
