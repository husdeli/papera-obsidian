import { describe, expect, it } from 'vitest';
import { paperaVaultLayout } from '../../src/domain/paperaVaultLayout';
import type { PaperaListedProject } from '../../src/models/paperaProject';

const ROOT = 'Papera';

interface FakeUnit {
	id: string;
	workflowId: string;
	title: string;
}

function listedProject(
	project: { id: string; name: string },
	workflows: { id: string; name: string }[],
	contentUnits: FakeUnit[] = [],
): PaperaListedProject {
	return { project, workflows, contentUnits };
}

function notePaths(listed: PaperaListedProject[]): string[] {
	return paperaVaultLayout.of(ROOT, listed).flatMap((one) => one.notes.map((note) => note.path));
}

describe('paperaVaultLayout', () => {
	it('places one folder per project and one per workflow under the reserved root', () => {
		const layout = paperaVaultLayout.of(ROOT, [
			listedProject({ id: 'project-1', name: 'Acme' }, [
				{ id: 'workflow-1', name: 'Research' },
				{ id: 'workflow-2', name: 'Drafts' },
			]),
		]);

		expect(layout[0]?.path).toBe('Papera/Acme');
		expect(layout[0]?.workflows.map((workflow) => workflow.path)).toEqual([
			'Papera/Acme/Research',
			'Papera/Acme/Drafts',
		]);
	});

	it('places one attachments folder inside every project folder', () => {
		const layout = paperaVaultLayout.of(ROOT, [
			listedProject({ id: 'project-1', name: 'Acme' }, []),
			listedProject({ id: 'project-2', name: 'Ledger' }, []),
		]);

		expect(layout.map((one) => one.attachmentsPath)).toEqual([
			'Papera/Acme/attachments',
			'Papera/Ledger/attachments',
		]);
	});

	it('places one note per content unit inside its workflow folder', () => {
		expect(
			notePaths([
				listedProject(
					{ id: 'project-1', name: 'Acme' },
					[{ id: 'workflow-1', name: 'Research' }],
					[{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes' }],
				),
			]),
		).toEqual(['Papera/Acme/Research/Kickoff notes.md']);
	});

	it('gives two projects sharing a name two distinct folders', () => {
		const layout = paperaVaultLayout.of(ROOT, [
			listedProject({ id: 'project-1', name: 'Acme' }, []),
			listedProject({ id: 'project-2', name: 'Acme' }, []),
		]);
		const paths = layout.map((one) => one.path);

		expect(new Set(paths).size).toBe(2);
		expect(paths).toContain('Papera/Acme');
	});

	it('gives two workflows sharing a name in one project two distinct folders', () => {
		const layout = paperaVaultLayout.of(ROOT, [
			listedProject({ id: 'project-1', name: 'Acme' }, [
				{ id: 'workflow-1', name: 'Drafts' },
				{ id: 'workflow-2', name: 'Drafts' },
			]),
		]);
		const paths = layout[0]?.workflows.map((workflow) => workflow.path) ?? [];

		expect(new Set(paths).size).toBe(2);
		expect(paths).toContain('Papera/Acme/Drafts');
	});

	it('gives two content units sharing a title in one workflow two distinct notes', () => {
		const paths = notePaths([
			listedProject(
				{ id: 'project-1', name: 'Acme' },
				[{ id: 'workflow-1', name: 'Research' }],
				[
					{ id: 'unit-1', workflowId: 'workflow-1', title: 'Kickoff notes' },
					{ id: 'unit-2', workflowId: 'workflow-1', title: 'Kickoff notes' },
				],
			),
		]);

		expect(new Set(paths).size).toBe(2);
		expect(paths).toContain('Papera/Acme/Research/Kickoff notes.md');
		expect(paths.every((path) => path.endsWith('.md'))).toBe(true);
	});

	it('keeps a workflow named attachments out of the attachments folder', () => {
		const layout = paperaVaultLayout.of(ROOT, [
			listedProject({ id: 'project-1', name: 'Acme' }, [
				{ id: 'workflow-1', name: 'Attachments' },
			]),
		]);

		expect(layout[0]?.workflows[0]?.path).not.toBe('Papera/Acme/attachments');
		expect(layout[0]?.workflows[0]?.path.startsWith('Papera/Acme/Attachments (')).toBe(true);
	});

	it('names a project, a workflow and a note whose name sanitizes to nothing', () => {
		const layout = paperaVaultLayout.of(ROOT, [
			listedProject(
				{ id: 'project-1', name: '...' },
				[{ id: 'workflow-1', name: '///' }],
				[{ id: 'unit-1', workflowId: 'workflow-1', title: '   ' }],
			),
		]);

		expect(layout[0]?.path.startsWith('Papera/Untitled (')).toBe(true);
		expect(layout[0]?.workflows[0]?.path).toContain('/Untitled (');
		expect(layout[0]?.notes[0]?.path).toContain('/Untitled (');
		expect(layout[0]?.notes[0]?.path.endsWith('.md')).toBe(true);
	});

	it('places every note exactly three segments under the reserved root', () => {
		const paths = notePaths([
			listedProject(
				{ id: 'project-1', name: 'Acme' },
				[
					{ id: 'workflow-1', name: 'Research' },
					{ id: 'workflow-2', name: 'Drafts' },
				],
				[
					{ id: 'unit-1', workflowId: 'workflow-1', title: 'One' },
					{ id: 'unit-2', workflowId: 'workflow-2', title: 'Two' },
				],
			),
			listedProject(
				{ id: 'project-2', name: 'Ledger' },
				[{ id: 'workflow-3', name: 'Inbox' }],
				[{ id: 'unit-3', workflowId: 'workflow-3', title: 'Three' }],
			),
		]);

		expect(paths).toHaveLength(3);

		for (const path of paths) {
			expect(path.split('/')).toHaveLength(4);
			expect(path.startsWith(`${ROOT}/`)).toBe(true);
		}
	});

	it('leaves out a content unit whose workflow the listing does not name', () => {
		expect(
			notePaths([
				listedProject(
					{ id: 'project-1', name: 'Acme' },
					[{ id: 'workflow-1', name: 'Research' }],
					[{ id: 'unit-1', workflowId: 'workflow-9', title: 'Orphan' }],
				),
			]),
		).toEqual([]);
	});
});
