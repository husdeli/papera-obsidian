import { Notice, type ObsidianProtocolData, Plugin } from 'obsidian';
import { paperaConfig } from './config/papera.config';
import { paperaPullNotice } from './domain/paperaPullNotice';
import { PaperaPull } from './services/PaperaPull';
import { PaperaSession } from './services/PaperaSession';
import { PaperaSettingsStore } from './services/PaperaSettingsStore';
import { PaperaVault } from './services/PaperaVault';
import { PaperaVaultIndex } from './services/PaperaVaultIndex';
import { PaperaVaultMap } from './services/PaperaVaultMap';
import { PaperaSettingTab } from './ui/PaperaSettingTab';

export default class PaperaPlugin extends Plugin {
	private setup: Promise<void> = Promise.resolve();
	private settingTab: PaperaSettingTab | undefined;

	async onload(): Promise<void> {
		this.registerObsidianProtocolHandler(paperaConfig.protocolAction, (params) => {
			void this.completeSignIn(params);
		});

		this.addCommand({
			id: 'sync-now',
			name: 'Sync now',
			callback: () => {
				void this.syncNow();
			},
		});

		this.setup = this.startUp();
		await this.setup;
	}

	onunload(): void {}

	private async startUp(): Promise<void> {
		await PaperaSettingsStore.load(this);
		PaperaVault.load();
		await PaperaVaultIndex.load(this);
		await this.restoreAccountRecord();

		this.buildMap();

		this.settingTab = new PaperaSettingTab(this.app, this, (url) => {
			window.open(url);
		});
		this.addSettingTab(this.settingTab);
	}

	private async restoreAccountRecord(): Promise<void> {
		const accountId = PaperaSession.accountId();

		if (PaperaVaultIndex.accountId() !== undefined || accountId === undefined) {
			return;
		}

		await PaperaVaultIndex.recordAccount(this, accountId);
	}

	private buildMap(): void {
		const loadedIntoRunningSession = this.app.workspace.layoutReady;

		this.app.workspace.onLayoutReady(() => {
			PaperaVault.onMetadataResolvedOnce(this, () => {
				void PaperaVaultMap.build(this);
			});

			if (loadedIntoRunningSession || PaperaVault.isMetadataWarm(this)) {
				void PaperaVaultMap.build(this);

				return;
			}

			// clearInterval also clears a timeout, so Obsidian detaches this one on unload.
			this.registerInterval(
				window.setTimeout(() => {
					void PaperaVaultMap.build(this);
				}, paperaConfig.mapBuildDelayMs),
			);
		});
	}

	private async syncNow(): Promise<void> {
		await this.setup;

		try {
			new Notice(paperaPullNotice.of(await PaperaPull.run(this)));
		} catch (error) {
			new Notice(error instanceof Error ? error.message : 'The Papera sync failed.');
		}
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
