import { vi } from 'vitest';

export const requestUrl = vi.fn();

export class Plugin {
	loadData = vi.fn();
	saveData = vi.fn();
	addSettingTab = vi.fn();
	registerObsidianProtocolHandler = vi.fn();

	constructor(readonly app: unknown) {}
}

export class PluginSettingTab {
	update = vi.fn();
	refreshDomState = vi.fn();

	constructor(readonly app: unknown) {}

	getControlValue(): unknown {
		return undefined;
	}

	setControlValue(): void {}
}

export class Notice {
	constructor(readonly message: string) {}
}
