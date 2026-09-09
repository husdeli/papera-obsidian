import type { Plugin } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaHttpError } from '../../src/models/PaperaHttpError';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';
import { PaperaSyncApi } from '../../src/services/PaperaSyncApi';

const httpClient = vi.hoisted(() => ({
	requestJson: vi.fn(),
}));

vi.mock('../../src/services/paperaAuthorizedHttpClient', () => ({
	paperaAuthorizedHttpClient: httpClient,
}));

const plugin = {} as Plugin;
const BASE_URL = 'https://papera.dev';

function answers(...pages: unknown[]): void {
	httpClient.requestJson.mockReset();

	for (const page of pages) {
		httpClient.requestJson.mockResolvedValueOnce(page);
	}
}

function requestedUrls(): string[] {
	return httpClient.requestJson.mock.calls.map((call) => (call[1] as { url: string }).url);
}

async function loadSettings(baseUrl: string): Promise<void> {
	await PaperaSettingsStore.load({
		loadData: vi.fn().mockResolvedValue({ baseUrl }),
		saveData: vi.fn(),
	} as unknown as Plugin);
}

describe('PaperaSyncApi', () => {
	beforeEach(async () => {
		httpClient.requestJson.mockReset();
		await loadSettings(BASE_URL);
	});

	describe('the project listing', () => {
		it('answers every project the person owns', async () => {
			answers({ projects: [{ id: 'project-1', name: 'Acme' }, { id: 'project-2', name: '' }] });

			await expect(PaperaSyncApi.projects(plugin)).resolves.toEqual([
				{ id: 'project-1', name: 'Acme' },
				{ id: 'project-2', name: '' },
			]);
		});

		it('asks the sync resource of the signed-in address, with the page size', async () => {
			answers({ projects: [] });

			await PaperaSyncApi.projects(plugin);

			expect(requestedUrls()).toEqual([
				'https://papera.dev/api/sync/projects?page_size=100',
			]);
		});

		it('joins the origin of an address that ends in a slash', async () => {
			await loadSettings('https://staging.papera.dev/');
			answers({ projects: [] });

			await PaperaSyncApi.projects(plugin);

			expect(requestedUrls()[0]).toBe(
				'https://staging.papera.dev/api/sync/projects?page_size=100',
			);
		});

		it('skips a project the listing gives no id', async () => {
			answers({ projects: [{ name: 'Acme' }, { id: 'project-2', name: 'Ledger' }] });

			await expect(PaperaSyncApi.projects(plugin)).resolves.toEqual([
				{ id: 'project-2', name: 'Ledger' },
			]);
		});

		it('follows the cursor to the end and answers every item of all three pages', async () => {
			answers(
				{ projects: [{ id: 'project-1', name: 'One' }], next_cursor: 'page-2' },
				{ projects: [{ id: 'project-2', name: 'Two' }], next_cursor: 'page-3' },
				{ projects: [{ id: 'project-3', name: 'Three' }] },
			);

			const projects = await PaperaSyncApi.projects(plugin);

			expect(projects.map((project) => project.id)).toEqual([
				'project-1',
				'project-2',
				'project-3',
			]);
			expect(requestedUrls()).toEqual([
				'https://papera.dev/api/sync/projects?page_size=100',
				'https://papera.dev/api/sync/projects?page_size=100&cursor=page-2',
				'https://papera.dev/api/sync/projects?page_size=100&cursor=page-3',
			]);
		});

		it('stops when a listing answers the cursor it was asked with', async () => {
			answers(
				{ projects: [{ id: 'project-1', name: 'One' }], next_cursor: 'page-2' },
				{ projects: [{ id: 'project-2', name: 'Two' }], next_cursor: 'page-2' },
			);

			await PaperaSyncApi.projects(plugin);

			expect(httpClient.requestJson).toHaveBeenCalledTimes(2);
		});

		it('answers no project when the listing answers nothing at all', async () => {
			answers(undefined);

			await expect(PaperaSyncApi.projects(plugin)).resolves.toEqual([]);
		});
	});

	describe('the contents of one project', () => {
		it('answers the workflows and the content units, with no body', async () => {
			answers({
				workflows: [{ id: 'workflow-1', name: 'Research' }],
				content_units: [
					{
						id: 'unit-1',
						workflow_id: 'workflow-1',
						title: 'Kickoff notes',
						revision: 7,
						updated_at: '2026-08-30T10:00:00Z',
					},
				],
			});

			await expect(PaperaSyncApi.contentsOf(plugin, 'project-1')).resolves.toEqual({
				workflows: [{ id: 'workflow-1', name: 'Research' }],
				contentUnits: [
					{
						id: 'unit-1',
						workflowId: 'workflow-1',
						title: 'Kickoff notes',
						revision: 7,
						lastChangedAt: '2026-08-30T10:00:00Z',
					},
				],
			});
		});

		it('asks for the contents of the project it was given', async () => {
			answers({ workflows: [], content_units: [] });

			await PaperaSyncApi.contentsOf(plugin, 'project 1/a');

			expect(requestedUrls()[0]).toBe(
				'https://papera.dev/api/sync/projects/project%201%2Fa/contents?page_size=100',
			);
		});

		it('reads a numeric revision string as a number', async () => {
			answers({
				workflows: [],
				content_units: [{ id: 'unit-1', workflow_id: 'workflow-1', revision: '12' }],
			});

			const contents = await PaperaSyncApi.contentsOf(plugin, 'project-1');

			expect(contents.contentUnits[0]?.revision).toBe(12);
		});

		it.each([
			['a word', 'twelve'],
			['an empty string', ''],
			['a boolean', true],
		])('answers an unknown revision for %s', async (_name, revision) => {
			answers({
				workflows: [],
				content_units: [{ id: 'unit-1', workflow_id: 'workflow-1', revision }],
			});

			const contents = await PaperaSyncApi.contentsOf(plugin, 'project-1');

			expect(contents.contentUnits[0]?.revision).toBeUndefined();
		});

		it('skips a content unit that names no workflow', async () => {
			answers({ workflows: [], content_units: [{ id: 'unit-1', title: 'Orphan' }] });

			const contents = await PaperaSyncApi.contentsOf(plugin, 'project-1');

			expect(contents.contentUnits).toEqual([]);
		});

		it('holds one workflow when two pages both name it', async () => {
			answers(
				{
					workflows: [{ id: 'workflow-1', name: 'Research' }],
					content_units: [{ id: 'unit-1', workflow_id: 'workflow-1' }],
					next_cursor: 'page-2',
				},
				{
					workflows: [{ id: 'workflow-1', name: 'Research' }],
					content_units: [{ id: 'unit-2', workflow_id: 'workflow-1' }],
				},
			);

			const contents = await PaperaSyncApi.contentsOf(plugin, 'project-1');

			expect(contents.workflows).toHaveLength(1);
			expect(contents.contentUnits).toHaveLength(2);
		});
	});

	describe('the body of one content unit', () => {
		it('answers the Markdown the API returns', async () => {
			answers({ markdown: '# Kickoff\n' });

			await expect(PaperaSyncApi.bodyOf(plugin, 'unit-1')).resolves.toBe('# Kickoff\n');
			expect(requestedUrls()[0]).toBe('https://papera.dev/api/sync/content-units/unit-1');
		});

		it('answers an empty body when the answer carries no Markdown', async () => {
			answers({});

			await expect(PaperaSyncApi.bodyOf(plugin, 'unit-1')).resolves.toBe('');
		});
	});

	describe('a refused request', () => {
		it.each([
			['not permitted', 403],
			['not there', 404],
			['sending too fast', 429],
			['Papera itself failing', 500],
			['the transport failing', 0],
		])('lets the caller tell %s apart', async (_name, status) => {
			httpClient.requestJson.mockRejectedValue(new PaperaHttpError(status, 'refused'));

			await expect(PaperaSyncApi.contentsOf(plugin, 'project-1')).rejects.toMatchObject({
				status,
			});
		});
	});
});
