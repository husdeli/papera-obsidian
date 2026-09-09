import {
	type App,
	type Command,
	type ObsidianProtocolData,
	type ObsidianProtocolHandler,
	type PluginManifest,
	TFile,
	type TFolder,
} from 'obsidian';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import PaperaPlugin from '../src/main';
import { shownNotices } from './stubs/obsidian';
import type { PaperaIndex } from '../src/models/paperaIndex';
import { PaperaVaultIndex } from '../src/services/PaperaVaultIndex';
import { PaperaVaultMap } from '../src/services/PaperaVaultMap';

const session = vi.hoisted(() => ({
	completeSignIn: vi.fn(),
	isSignedIn: vi.fn(() => false),
	accountId: vi.fn((): string | undefined => undefined),
}));

vi.mock('../src/services/PaperaSession', () => ({ PaperaSession: session }));

const pull = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock('../src/services/PaperaPull', () => ({ PaperaPull: pull }));

vi.stubGlobal('window', { open: vi.fn(), setTimeout: globalThis.setTimeout.bind(globalThis) });

const callback: ObsidianProtocolData = { action: 'papera-auth', code: 'code-1', state: 'state-1' };
const NOTE_PATH = 'Papera/Book Club/Drafts/note.md';
const INDEX_PATH = 'Papera/.papera-index.json';

interface VaultOptions {
	layoutReady?: boolean;
	warm?: boolean;
	rootExists?: boolean;
	savedIndex?: string;
}

const events: string[] = [];

function appStub(options: VaultOptions = {}) {
	const note = Object.assign(new TFile(), { path: NOTE_PATH });
	const root = { path: 'Papera', children: [note] } as unknown as TFolder;
	const resolvedHandlers: (() => void)[] = [];

	return {
		resolvedHandlers,
		app: {
			workspace: {
				layoutReady: options.layoutReady ?? false,
				onLayoutReady: vi.fn((run: () => void) => {
					events.push('layout-ready');
					run();
				}),
			},
			vault: {
				getFolderByPath: vi.fn(() => (options.rootExists ?? false ? root : null)),
				cachedRead: vi.fn(() => Promise.resolve('')),
				adapter: {
					read: vi.fn(() => {
						events.push('index-read');

						return options.savedIndex === undefined
							? Promise.reject(new Error('ENOENT'))
							: Promise.resolve(options.savedIndex);
					}),
					write: vi.fn(() => Promise.resolve()),
				},
			},
			metadataCache: {
				resolvedLinks: options.warm ?? false ? { [NOTE_PATH]: {} } : {},
				getFileCache: vi.fn(() => ({ frontmatter: { papera_id: 'unit-1' } })),
				on: vi.fn((_name: string, run: () => void) => {
					resolvedHandlers.push(run);

					return { name: _name };
				}),
			},
		},
	};
}

function newPlugin(stub: ReturnType<typeof appStub>): PaperaPlugin {
	return new PaperaPlugin(stub.app as unknown as App, {} as PluginManifest);
}

function spiesOf(plugin: PaperaPlugin) {
	return plugin as unknown as {
		addSettingTab: Mock;
		addCommand: Mock<(command: Command) => void>;
		registerObsidianProtocolHandler: Mock<
			(action: string, handler: ObsidianProtocolHandler) => void
		>;
	};
}

function registeredHandler(plugin: PaperaPlugin): ObsidianProtocolHandler {
	const register = spiesOf(plugin).registerObsidianProtocolHandler;

	expect(register).toHaveBeenCalledWith('papera-auth', expect.any(Function));

	return register.mock.calls[0]?.[1] as ObsidianProtocolHandler;
}

function forgetVaultState(): void {
	const map = PaperaVaultMap as unknown as {
		owned: Map<string, unknown>;
		building: Promise<void> | undefined;
		built: unknown;
	};

	map.owned = new Map();
	map.building = undefined;
	map.built = undefined;
	(PaperaVaultIndex as unknown as { owned: PaperaIndex | undefined }).owned = undefined;
}

describe('PaperaPlugin', () => {
	beforeEach(() => {
		events.length = 0;
		forgetVaultState();
		shownNotices.length = 0;
		session.completeSignIn.mockReset().mockResolvedValue(undefined);
		session.accountId.mockReset().mockReturnValue(undefined);
		pull.run.mockReset().mockResolvedValue({
			projects: [{ id: 'project-1', name: 'Acme', outcome: 'synced', failedNotes: 0 }],
			notesWritten: 2,
			notesRenamed: 0,
			notesRemoved: 0,
			unansweredNotes: 0,
		});
	});

	it('registers the protocol handler and adds the setting tab', async () => {
		const plugin = newPlugin(appStub());

		await plugin.onload();

		expect(spiesOf(plugin).addSettingTab).toHaveBeenCalledTimes(1);
		expect(registeredHandler(plugin)).toBeTypeOf('function');
	});

	it('completes a callback that arrives before the setup finishes', async () => {
		const plugin = newPlugin(appStub());
		const loading = plugin.onload();

		registeredHandler(plugin)(callback);

		expect(session.completeSignIn).not.toHaveBeenCalled();

		await loading;
		await vi.waitFor(() => {
			expect(session.completeSignIn).toHaveBeenCalledWith(plugin, callback);
		});
	});

	it('reads the account file before the layout is ready', async () => {
		await newPlugin(appStub({ savedIndex: '{"version":1}' })).onload();

		expect(events).toEqual(['index-read', 'layout-ready']);
	});

	describe('the map build', () => {
		it('completes on a warm cache that fires no resolved event', async () => {
			const stub = appStub({ warm: true, rootExists: true });

			await newPlugin(stub).onload();
			await PaperaVaultMap.ready();

			expect(PaperaVaultMap.get('unit-1')?.path).toBe(NOTE_PATH);
			expect(stub.resolvedHandlers).toHaveLength(1);
		});

		it('completes for a plugin enabled inside a running session', async () => {
			const stub = appStub({ layoutReady: true, rootExists: true });

			await newPlugin(stub).onload();

			await expect(PaperaVaultMap.ready()).resolves.toBeUndefined();
		});

		it('completes on a cold cache once the resolved event fires', async () => {
			const stub = appStub({ rootExists: true });
			let ready = false;

			void PaperaVaultMap.ready().then(() => {
				ready = true;
			});

			await newPlugin(stub).onload();
			await Promise.resolve();

			expect(ready).toBe(false);

			stub.resolvedHandlers[0]?.();
			await PaperaVaultMap.ready();

			expect(ready).toBe(true);
			expect(PaperaVaultMap.get('unit-1')?.path).toBe(NOTE_PATH);
		});

		it('walks the vault once when both paths reach the build', async () => {
			const stub = appStub({ warm: true, rootExists: true });

			await newPlugin(stub).onload();
			stub.resolvedHandlers[0]?.();
			await PaperaVaultMap.ready();

			expect(stub.app.vault.getFolderByPath).toHaveBeenCalledTimes(1);
		});
	});

	describe('the sync command', () => {
		function syncCommand(plugin: PaperaPlugin): Command {
			const register = spiesOf(plugin).addCommand;

			expect(register).toHaveBeenCalledTimes(1);

			return register.mock.calls[0]?.[0] as Command;
		}

		it('registers the command in the palette', async () => {
			const plugin = newPlugin(appStub());

			await plugin.onload();

			expect(syncCommand(plugin)).toMatchObject({ id: 'sync-now', name: 'Sync now' });
		});

		it('shows what the pull did', async () => {
			const plugin = newPlugin(appStub());

			await plugin.onload();
			syncCommand(plugin).callback?.();

			await vi.waitFor(() => {
				expect(shownNotices).toEqual(['Synced Acme. 2 notes written.']);
			});
		});

		it('shows a failure rather than throwing', async () => {
			const plugin = newPlugin(appStub());

			pull.run.mockRejectedValue(new Error('This vault is not signed in to Papera.'));

			await plugin.onload();

			expect(() => {
				syncCommand(plugin).callback?.();
			}).not.toThrow();

			await vi.waitFor(() => {
				expect(shownNotices).toEqual(['This vault is not signed in to Papera.']);
			});
		});

		it('loads the plugin and registers the command while the vault is signed out', async () => {
			session.isSignedIn.mockReturnValue(false);

			const plugin = newPlugin(appStub());

			await expect(plugin.onload()).resolves.toBeUndefined();
			expect(syncCommand(plugin)).toBeDefined();
		});
	});

	describe('the account record', () => {
		it('writes the file again when it names nobody and the reserved root folder exists', async () => {
			const stub = appStub({ savedIndex: '{"version":1}', rootExists: true, warm: true });

			session.accountId.mockReturnValue('account-1');

			await newPlugin(stub).onload();

			expect(stub.app.vault.adapter.write).toHaveBeenCalledWith(
				INDEX_PATH,
				JSON.stringify({ version: 1, accountId: 'account-1' }),
			);
		});

		it('writes nothing when the reserved root folder does not exist', async () => {
			const stub = appStub({ savedIndex: '{"version":1}' });

			session.accountId.mockReturnValue('account-1');

			await newPlugin(stub).onload();

			expect(stub.app.vault.adapter.write).not.toHaveBeenCalled();
		});

		it('writes nothing when the file already names the account', async () => {
			const stub = appStub({
				savedIndex: '{"version":1,"accountId":"account-1"}',
				rootExists: true,
			});

			session.accountId.mockReturnValue('account-1');

			await newPlugin(stub).onload();

			expect(stub.app.vault.adapter.write).not.toHaveBeenCalled();
		});
	});
});
