import type { PaperaVaultEntry } from '../models/paperaVaultEntry';
import type { PaperaNoteLayout, PaperaProjectLayout } from './paperaVaultLayout';

const NOTE_DEPTH_UNDER_ROOT = 3;
const PROJECT_SEGMENTS = 1;
const WORKFLOW_SEGMENTS = 2;

export interface PaperaPathRename {
	fromPath: string;
	toPath: string;
}

export interface PaperaNoteRemoval {
	contentUnitId: string;
	path: string;
}

export interface PaperaVaultActions {
	folderRenames: PaperaPathRename[];
	folders: string[];
	noteRenames: PaperaPathRename[];
	writes: PaperaNoteLayout[];
	removals: PaperaNoteRemoval[];
	unansweredNotes: string[];
}

export interface PaperaVaultPlanRequest {
	reservedRoot: string;
	projects: PaperaProjectLayout[];
	known: Map<string, PaperaVaultEntry>;
}

interface PaperaKnownNote {
	id: string;
	path: string;
	revision?: number;
}

interface PaperaFolderOwners {
	projects: Map<string, string>;
	workflows: Map<string, string>;
	ownedWorkflows: Set<string>;
}

function rootSegments(reservedRoot: string): number {
	return reservedRoot.split('/').length;
}

function ancestorPath(path: string, reservedRoot: string, segments: number): string {
	return path
		.split('/')
		.slice(0, rootSegments(reservedRoot) + segments)
		.join('/');
}

function shorterPath(one: string, other: string): string {
	if (one.length !== other.length) {
		return one.length < other.length ? one : other;
	}

	return one < other ? one : other;
}

function claim(claims: Map<string, string>, id: string, path: string): void {
	const known = claims.get(id);

	claims.set(id, known === undefined ? path : shorterPath(known, path));
}

function movedBy(renames: PaperaPathRename[], path: string): string {
	let moved = path;

	for (const rename of renames) {
		if (moved === rename.fromPath) {
			moved = rename.toPath;
		} else if (moved.startsWith(`${rename.fromPath}/`)) {
			moved = `${rename.toPath}${moved.slice(rename.fromPath.length)}`;
		}
	}

	return moved;
}

function knownNotes(request: PaperaVaultPlanRequest): PaperaKnownNote[] {
	const notes: PaperaKnownNote[] = [];

	for (const [id, entry] of request.known) {
		const depth = entry.path.split('/').length - rootSegments(request.reservedRoot);

		if (depth === NOTE_DEPTH_UNDER_ROOT) {
			notes.push({ id, path: entry.path, revision: entry.revision });
		}
	}

	return notes;
}

function folderNameOf(path: string): string {
	const segments = path.split('/');

	return segments[segments.length - 1] ?? '';
}

function ownListedWorkflowFolders(request: PaperaVaultPlanRequest, owners: PaperaFolderOwners): void {
	for (const project of request.projects) {
		const projectFolder = owners.projects.get(project.project.id);

		if (projectFolder === undefined) {
			continue;
		}

		for (const workflow of project.workflows) {
			owners.ownedWorkflows.add(`${projectFolder}/${folderNameOf(workflow.path)}`);
		}
	}
}

function invertFolders(
	request: PaperaVaultPlanRequest,
	notesById: Map<string, PaperaKnownNote>,
): PaperaFolderOwners {
	const owners: PaperaFolderOwners = {
		projects: new Map(),
		workflows: new Map(),
		ownedWorkflows: new Set(),
	};

	for (const project of request.projects) {
		for (const note of project.notes) {
			const known = notesById.get(note.contentUnit.id);

			if (known === undefined) {
				continue;
			}

			const workflowFolder = ancestorPath(known.path, request.reservedRoot, WORKFLOW_SEGMENTS);

			claim(
				owners.projects,
				project.project.id,
				ancestorPath(known.path, request.reservedRoot, PROJECT_SEGMENTS),
			);
			claim(owners.workflows, note.contentUnit.workflowId, workflowFolder);
			owners.ownedWorkflows.add(workflowFolder);
		}
	}

	ownListedWorkflowFolders(request, owners);

	return owners;
}

function plannedFolderRenames(
	request: PaperaVaultPlanRequest,
	owners: PaperaFolderOwners,
): PaperaPathRename[] {
	const renames: PaperaPathRename[] = [];

	for (const project of request.projects) {
		const current = owners.projects.get(project.project.id);

		if (current !== undefined && current !== project.path) {
			renames.push({ fromPath: current, toPath: project.path });
		}
	}

	for (const project of request.projects) {
		for (const workflow of project.workflows) {
			const current = owners.workflows.get(workflow.id);

			if (current === undefined) {
				continue;
			}

			const moved = movedBy(renames, current);

			if (moved !== workflow.path) {
				renames.push({ fromPath: moved, toPath: workflow.path });
			}
		}
	}

	return renames;
}

function plannedNoteRenames(
	request: PaperaVaultPlanRequest,
	notesById: Map<string, PaperaKnownNote>,
	folderRenames: PaperaPathRename[],
): PaperaPathRename[] {
	const renames: PaperaPathRename[] = [];

	for (const project of request.projects) {
		for (const note of project.notes) {
			const known = notesById.get(note.contentUnit.id);

			if (known === undefined) {
				continue;
			}

			const moved = movedBy(folderRenames, known.path);

			if (moved !== note.path) {
				renames.push({ fromPath: moved, toPath: note.path });
			}
		}
	}

	return renames;
}

function plannedFolders(
	request: PaperaVaultPlanRequest,
	folderRenames: PaperaPathRename[],
): string[] {
	const destinations = new Set(folderRenames.map((rename) => rename.toPath));

	return request.projects.flatMap((project) =>
		[
			project.path,
			project.attachmentsPath,
			...project.workflows.map((workflow) => workflow.path),
		].filter((path) => !destinations.has(path)),
	);
}

function plannedWrites(
	request: PaperaVaultPlanRequest,
	notesById: Map<string, PaperaKnownNote>,
): PaperaNoteLayout[] {
	return request.projects.flatMap((project) =>
		project.notes.filter((note) => {
			const known = notesById.get(note.contentUnit.id);
			const listed = note.contentUnit.revision;

			return known === undefined || listed === undefined || known.revision !== listed;
		}),
	);
}

function unanswered(
	request: PaperaVaultPlanRequest,
	notes: PaperaKnownNote[],
	owners: PaperaFolderOwners,
	folderRenames: PaperaPathRename[],
): Pick<PaperaVaultActions, 'removals' | 'unansweredNotes'> {
	const answered = new Set(
		request.projects.flatMap((project) => project.notes.map((note) => note.contentUnit.id)),
	);
	const removals: PaperaNoteRemoval[] = [];
	const unansweredNotes: string[] = [];

	for (const note of notes) {
		if (answered.has(note.id)) {
			continue;
		}

		const folder = ancestorPath(note.path, request.reservedRoot, WORKFLOW_SEGMENTS);
		const moved = movedBy(folderRenames, note.path);

		if (owners.ownedWorkflows.has(folder)) {
			removals.push({ contentUnitId: note.id, path: moved });
		} else {
			unansweredNotes.push(moved);
		}
	}

	return { removals, unansweredNotes };
}

export const paperaVaultPlan = {
	of(request: PaperaVaultPlanRequest): PaperaVaultActions {
		const notes = knownNotes(request);
		const notesById = new Map(notes.map((note) => [note.id, note]));
		const owners = invertFolders(request, notesById);
		const folderRenames = plannedFolderRenames(request, owners);

		return {
			folderRenames,
			folders: plannedFolders(request, folderRenames),
			noteRenames: plannedNoteRenames(request, notesById, folderRenames),
			writes: plannedWrites(request, notesById),
			...unanswered(request, notes, owners, folderRenames),
		};
	},
};
