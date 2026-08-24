import { Notice, type ObsidianProtocolData, Plugin } from 'obsidian';
import { paperaConfig } from './config/papera.config';
import { PaperaSession } from './services/PaperaSession';
import { PaperaSettingsStore } from './services/PaperaSettingsStore';
import { PaperaSettingTab } from './ui/PaperaSettingTab';

export default class PaperaPlugin extends Plugin {
	private setup: Promise<void> = Promise.resolve();
	private settingTab: PaperaSettingTab | undefined;

	async onload(): Promise<void> {
		this.registerObsidianProtocolHandler(paperaConfig.protocolAction, (params) => {
			void this.completeSignIn(params);
		});

		this.setup = this.startUp();
		await this.setup;
	}

	onunload(): void {}

	private async startUp(): Promise<void> {
		await PaperaSettingsStore.load(this);

		this.settingTab = new PaperaSettingTab(this.app, this, (url) => {
			window.open(url);
		});
		this.addSettingTab(this.settingTab);
	}

	private async completeSignIn(params: ObsidianProtocolData): Promise<void> {
		await this.setup;

		try {
			await PaperaSession.completeSignIn(this, params);
			this.settingTab?.update();
			new Notice('This vault is signed in.');
		} catch (error) {
			new Notice(error instanceof Error ? error.message : 'The Papera sign-in failed.');
		}
	}
}
