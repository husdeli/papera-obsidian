import type { Plugin } from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import type {
	PaperaContentUnit,
	PaperaProject,
	PaperaProjectContents,
	PaperaWorkflow,
} from '../models/paperaProject';
import { PaperaSettingsStore } from './PaperaSettingsStore';
import { paperaAuthorizedHttpClient } from './paperaAuthorizedHttpClient';

const PROJECTS_PATH = '/projects';
const CONTENT_UNITS_PATH = '/content-units';
const CONTENTS_SEGMENT = '/contents';
const PROJECTS_FIELD = 'projects';
const WORKFLOWS_FIELD = 'workflows';
const CONTENT_UNITS_FIELD = 'content_units';
const MARKDOWN_FIELD = 'markdown';
const CURSOR_FIELD = 'next_cursor';
const CURSOR_PARAM = 'cursor';
const PAGE_SIZE_PARAM = 'page_size';
const NUMERIC = /^-?\d+$/;
const TRAILING_SLASHES = /\/+$/;

type PaperaSyncPage = Record<string, unknown>;

function asRecord(value: unknown): PaperaSyncPage {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return {};
	}

	return value as PaperaSyncPage;
}

function asRecords(value: unknown): PaperaSyncPage[] {
	return Array.isArray(value) ? (value as unknown[]).map(asRecord) : [];
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}

function asRevision(value: unknown): number | undefined {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}

	if (typeof value !== 'string' || !NUMERIC.test(value)) {
		return undefined;
	}

	const parsed = Number(value);

	return Number.isFinite(parsed) ? parsed : undefined;
}

function toProject(fields: PaperaSyncPage): PaperaProject | undefined {
	const id = asString(fields.id);

	return id === undefined ? undefined : { id, name: asString(fields.name) ?? '' };
}

function toWorkflow(fields: PaperaSyncPage): PaperaWorkflow | undefined {
	const id = asString(fields.id);

	return id === undefined ? undefined : { id, name: asString(fields.name) ?? '' };
}

function toContentUnit(fields: PaperaSyncPage): PaperaContentUnit | undefined {
	const id = asString(fields.id);
	const workflowId = asString(fields.workflow_id);

	if (id === undefined || workflowId === undefined) {
		return undefined;
	}

	return {
		id,
		workflowId,
		title: asString(fields.title) ?? '',
		revision: asRevision(fields.revision),
		lastChangedAt: asString(fields.updated_at),
	};
}

export class PaperaSyncApi {
	static async projects(plugin: Plugin): Promise<PaperaProject[]> {
		const projects = new Map<string, PaperaProject>();

		await PaperaSyncApi.walk(plugin, PROJECTS_PATH, (page) => {
			for (const fields of asRecords(page[PROJECTS_FIELD])) {
				const project = toProject(fields);

				if (project !== undefined) {
					projects.set(project.id, project);
				}
			}
		});

		return [...projects.values()];
	}

	static async contentsOf(plugin: Plugin, projectId: string): Promise<PaperaProjectContents> {
		const workflows = new Map<string, PaperaWorkflow>();
		const contentUnits = new Map<string, PaperaContentUnit>();
		const path = `${PROJECTS_PATH}/${encodeURIComponent(projectId)}${CONTENTS_SEGMENT}`;

		await PaperaSyncApi.walk(plugin, path, (page) => {
			for (const fields of asRecords(page[WORKFLOWS_FIELD])) {
				const workflow = toWorkflow(fields);

				if (workflow !== undefined) {
					workflows.set(workflow.id, workflow);
				}
			}

			for (const fields of asRecords(page[CONTENT_UNITS_FIELD])) {
				const contentUnit = toContentUnit(fields);

				if (contentUnit !== undefined) {
					contentUnits.set(contentUnit.id, contentUnit);
				}
			}
		});

		return { workflows: [...workflows.values()], contentUnits: [...contentUnits.values()] };
	}

	static async bodyOf(plugin: Plugin, contentUnitId: string): Promise<string> {
		const path = `${CONTENT_UNITS_PATH}/${encodeURIComponent(contentUnitId)}`;
		const answer = asRecord(
			await paperaAuthorizedHttpClient.requestJson<unknown>(plugin, {
				url: PaperaSyncApi.address(path),
			}),
		);
		const body = answer[MARKDOWN_FIELD];

		return typeof body === 'string' ? body : '';
	}

	private static async walk(
		plugin: Plugin,
		path: string,
		read: (page: PaperaSyncPage) => void,
	): Promise<void> {
		let cursor: string | undefined;

		for (;;) {
			const page = asRecord(
				await paperaAuthorizedHttpClient.requestJson<unknown>(plugin, {
					url: PaperaSyncApi.listingAddress(path, cursor),
				}),
			);

			read(page);

			const next = asString(page[CURSOR_FIELD]);

			// A listing that answers the cursor it was asked with would never end.
			if (next === undefined || next === cursor) {
				return;
			}

			cursor = next;
		}
	}

	private static listingAddress(path: string, cursor: string | undefined): string {
		const url = new URL(PaperaSyncApi.address(path));

		url.searchParams.set(PAGE_SIZE_PARAM, String(paperaConfig.listingPageSize));

		if (cursor !== undefined) {
			url.searchParams.set(CURSOR_PARAM, cursor);
		}

		return url.toString();
	}

	private static address(path: string): string {
		const origin = PaperaSettingsStore.current().baseUrl.replace(TRAILING_SLASHES, '');

		return `${origin}${paperaConfig.resourcePath}${path}`;
	}
}
