import { Plugin } from 'obsidian';
import type { PaperaSettings } from './models/paperaSettings';
import { PaperaSettingsStore } from './services/PaperaSettingsStore';

export default class PaperaPlugin extends Plugin {
	settings!: PaperaSettings;

	async onload(): Promise<void> {
		this.settings = await PaperaSettingsStore.load(this);
		await PaperaSettingsStore.save(this, this.settings);
	}

	onunload(): void {}
}
