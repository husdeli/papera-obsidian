import type { App, Plugin, SettingDefinition, SettingDefinitionGroup } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperaSettingsStore } from '../../src/services/PaperaSettingsStore';
import { PaperaSettingTab } from '../../src/ui/PaperaSettingTab';

const session = vi.hoisted(() => ({
	isSignedIn: vi.fn(() => false),
	accountId: vi.fn((): string | undefined => undefined),
	startSignIn: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock('../../src/services/PaperaSession', () => ({ PaperaSession: session }));

const BASE_URL = 'https://papera.dev';
const RESERVED_ROOT = 'Papera';

function pluginStub() {
	const plugin = {
		loadData: vi.fn().mockResolvedValue({ baseUrl: BASE_URL, reservedRoot: RESERVED_ROOT }),
		saveData: vi.fn().mockResolvedValue(undefined),
	};

	return { plugin, asPlugin: plugin as unknown as Plugin };
}

function visibleRowNames(tab: PaperaSettingTab): string[] {
	const group = tab.getSettingDefinitions()[0] as SettingDefinitionGroup;
	const rows = (group.items ?? []) as SettingDefinition[];

	return rows.filter(isShown).map((row) => row.name);
}

function isShown(row: SettingDefinition): boolean {
	return typeof row.visible === 'function' ? row.visible() : row.visible !== false;
}

function rowNamed(tab: PaperaSettingTab, name: string): SettingDefinition {
	const group = tab.getSettingDefinitions()[0] as SettingDefinitionGroup;
	const row = ((group.items ?? []) as SettingDefinition[]).find((item) => item.name === name);

	if (row === undefined) {
		throw new Error(`The setting tab has no row named ${name}.`);
	}

	return row;
}

describe('PaperaSettingTab', () => {
	let tab: PaperaSettingTab;
	let plugin: ReturnType<typeof pluginStub>['plugin'];

	beforeEach(async () => {
		const stub = pluginStub();

		plugin = stub.plugin;
		await PaperaSettingsStore.load(stub.asPlugin);
		tab = new PaperaSettingTab({} as App, stub.asPlugin, vi.fn());
		session.isSignedIn.mockReturnValue(false);
		session.accountId.mockReturnValue(undefined);
	});

	it('shows the sign-in row while the vault is signed out', () => {
		expect(visibleRowNames(tab)).toEqual(['Papera address', 'Papera folder', 'Sign in']);
	});

	it('shows the sign-out row with the account while the vault is signed in', () => {
		session.isSignedIn.mockReturnValue(true);
		session.accountId.mockReturnValue('account-1');

		expect(visibleRowNames(tab)).toEqual(['Papera address', 'Papera folder', 'Sign out']);
		expect(rowNamed(tab, 'Sign out').desc).toContain('account-1');
	});

	it('reads the base URL through the settings store', () => {
		expect(tab.getControlValue('baseUrl')).toBe(BASE_URL);
	});

	it('writes the base URL through the settings store', async () => {
		await tab.setControlValue('baseUrl', 'http://localhost:8080');

		expect(PaperaSettingsStore.current().baseUrl).toBe('http://localhost:8080');
		expect(plugin.saveData).toHaveBeenCalledWith(
			expect.objectContaining({ baseUrl: 'http://localhost:8080' }),
		);
	});

	it('reads the reserved root folder name through the settings store', () => {
		expect(tab.getControlValue('reservedRoot')).toBe(RESERVED_ROOT);
	});

	it('writes the reserved root folder name through the settings store', async () => {
		await tab.setControlValue('reservedRoot', 'Writing');

		expect(PaperaSettingsStore.current().reservedRoot).toBe('Writing');
	});

	it('refuses a reserved root folder name holding a separator', async () => {
		await tab.setControlValue('reservedRoot', 'Work/Papera');

		expect(PaperaSettingsStore.current().reservedRoot).toBe(RESERVED_ROOT);
		expect(plugin.saveData).not.toHaveBeenCalled();
	});
});
