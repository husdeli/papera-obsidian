import { type App, type Plugin, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import { paperaConfig } from '../config/papera.config';
import { type PaperaBrowserOpener, PaperaSession } from '../services/PaperaSession';
import { PaperaSettingsStore } from '../services/PaperaSettingsStore';

const BASE_URL_KEY = 'baseUrl';

export class PaperaSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly paperaPlugin: Plugin,
		private readonly openInBrowser: PaperaBrowserOpener,
	) {
		super(app, paperaPlugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Papera account',
				items: [
					{
						name: 'Papera address',
						desc: 'The address of the Papera server this vault signs in to.',
						control: {
							type: 'text',
							key: BASE_URL_KEY,
							defaultValue: paperaConfig.defaultSettings.baseUrl,
						},
					},
					{
						name: 'Sign in',
						desc: 'Approve this vault in your browser. One sign-in covers every project you own.',
						visible: () => !PaperaSession.isSignedIn(),
						action: () => {
							void PaperaSession.startSignIn(this.paperaPlugin, this.openInBrowser);
						},
					},
					{
						name: 'Sign out',
						desc: this.signedInAs(),
						visible: () => PaperaSession.isSignedIn(),
						action: () => {
							void this.signOut();
						},
					},
				],
			},
		];
	}

	// The inherited implementation reads and writes `plugin.settings`, and this plugin keeps its settings in PaperaSettingsStore.
	getControlValue(key: string): unknown {
		return key === BASE_URL_KEY ? PaperaSettingsStore.current().baseUrl : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key !== BASE_URL_KEY || typeof value !== 'string') {
			return;
		}

		await PaperaSettingsStore.update(this.paperaPlugin, { baseUrl: value });
	}

	private signedInAs(): string {
		const accountId = PaperaSession.accountId();

		return accountId === undefined
			? 'Stop the sync and keep every synced note in the vault.'
			: `This vault is signed in as the Papera account ${accountId}.`;
	}

	private async signOut(): Promise<void> {
		await PaperaSession.signOut(this.paperaPlugin);
		this.refreshDomState();
	}
}
