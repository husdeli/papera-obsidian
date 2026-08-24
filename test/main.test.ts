import type { App, ObsidianProtocolData, ObsidianProtocolHandler, PluginManifest } from 'obsidian';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import PaperaPlugin from '../src/main';

const session = vi.hoisted(() => ({
	completeSignIn: vi.fn(),
	isSignedIn: vi.fn(() => false),
	accountId: vi.fn((): string | undefined => undefined),
}));

vi.mock('../src/services/PaperaSession', () => ({ PaperaSession: session }));

const callback: ObsidianProtocolData = { action: 'papera-auth', code: 'code-1', state: 'state-1' };

function newPlugin(): PaperaPlugin {
	return new PaperaPlugin({} as App, {} as PluginManifest);
}

function spiesOf(plugin: PaperaPlugin) {
	return plugin as unknown as {
		addSettingTab: Mock;
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

describe('PaperaPlugin', () => {
	beforeEach(() => {
		session.completeSignIn.mockReset().mockResolvedValue(undefined);
	});

	it('registers the protocol handler and adds the setting tab', async () => {
		const plugin = newPlugin();

		await plugin.onload();

		expect(spiesOf(plugin).addSettingTab).toHaveBeenCalledTimes(1);
		expect(registeredHandler(plugin)).toBeTypeOf('function');
	});

	it('completes a callback that arrives before the setup finishes', async () => {
		const plugin = newPlugin();
		const loading = plugin.onload();

		registeredHandler(plugin)(callback);

		expect(session.completeSignIn).not.toHaveBeenCalled();

		await loading;
		await vi.waitFor(() => {
			expect(session.completeSignIn).toHaveBeenCalledWith(plugin, callback);
		});
	});
});
