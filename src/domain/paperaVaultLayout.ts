import type {
	PaperaContentUnit,
	PaperaListedProject,
	PaperaProject,
	PaperaWorkflow,
} from '../models/paperaProject';
import { type PaperaSibling, paperaFolderName } from './paperaFolderName';

const ATTACHMENTS_FOLDER = 'attachments';
const RESERVED_SIBLING_ID = '';
const MARKDOWN_SUFFIX = '.md';

export interface PaperaFolderLayout {
	id: string;
	path: string;
}

export interface PaperaNoteLayout {
	projectId: string;
	contentUnit: PaperaContentUnit;
	path: string;
}

export interface PaperaProjectLayout {
	project: PaperaProject;
	path: string;
	attachmentsPath: string;
	workflows: PaperaFolderLayout[];
	notes: PaperaNoteLayout[];
}

function siblingsOf(named: (PaperaProject | PaperaWorkflow)[]): PaperaSibling[] {
	return named.map(({ id, name }) => ({ id, name }));
}

function nameIn(names: Map<string, string>, sibling: PaperaSibling): string {
	return names.get(sibling.id) ?? paperaFolderName.sanitize(sibling.name);
}

function unitsByWorkflow(contentUnits: PaperaContentUnit[]): Map<string, PaperaContentUnit[]> {
	const grouped = new Map<string, PaperaContentUnit[]>();

	for (const contentUnit of contentUnits) {
		grouped.set(contentUnit.workflowId, [
			...(grouped.get(contentUnit.workflowId) ?? []),
			contentUnit,
		]);
	}

	return grouped;
}

function notesOf(
	projectId: string,
	workflowPath: string,
	contentUnits: PaperaContentUnit[],
): PaperaNoteLayout[] {
	const noteNames = paperaFolderName.forSiblings(
		contentUnits.map(({ id, title }) => ({ id, name: title })),
	);

	return contentUnits.map((contentUnit) => ({
		projectId,
		contentUnit,
		path: `${workflowPath}/${nameIn(noteNames, { id: contentUnit.id, name: contentUnit.title })}${MARKDOWN_SUFFIX}`,
	}));
}

function workflowsOf(projectPath: string, workflows: PaperaWorkflow[]): PaperaFolderLayout[] {
	const folderNames = paperaFolderName.forSiblings([
		{ id: RESERVED_SIBLING_ID, name: ATTACHMENTS_FOLDER },
		...siblingsOf(workflows),
	]);

	return workflows.map((workflow) => ({
		id: workflow.id,
		path: `${projectPath}/${nameIn(folderNames, workflow)}`,
	}));
}

export const paperaVaultLayout = {
	of(reservedRoot: string, listed: PaperaListedProject[]): PaperaProjectLayout[] {
		const folderNames = paperaFolderName.forSiblings(
			siblingsOf(listed.map(({ project }) => project)),
		);

		return listed.map((one) => {
			const path = `${reservedRoot}/${nameIn(folderNames, one.project)}`;
			const workflows = workflowsOf(path, one.workflows);
			const grouped = unitsByWorkflow(one.contentUnits);

			return {
				project: one.project,
				path,
				attachmentsPath: `${path}/${ATTACHMENTS_FOLDER}`,
				workflows,
				notes: workflows.flatMap((workflow) =>
					notesOf(one.project.id, workflow.path, grouped.get(workflow.id) ?? []),
				),
			};
		});
	},
};
