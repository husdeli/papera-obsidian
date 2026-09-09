import { vi } from 'vitest';

export const requestUrl = vi.fn();

export function normalizePath(path: string): string {
	const normalized = path
		.replace(/([\\/])+/g, '/')
		.replace(/(^\/|\/$)/g, '')
		.replace(/\u00A0|\u202F/g, ' ')
		.normalize('NFC');

	return normalized === '' ? '/' : normalized;
}

export class TAbstractFile {
	path = '';
}

export class TFile extends TAbstractFile {
	get extension(): string {
		return this.path.split('.').slice(1).pop() ?? '';
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export class Vault {
	static recurseChildren(root: TFolder, callback: (file: TAbstractFile) => void): void {
		callback(root);

		for (const child of root.children) {
			if (child instanceof TFolder) {
				Vault.recurseChildren(child, callback);
			} else {
				callback(child);
			}
		}
	}
}

export function getFrontMatterInfo(content: string): {
	exists: boolean;
	frontmatter: string;
	contentStart: number;
} {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);

	if (match === null) {
		return { exists: false, frontmatter: '', contentStart: 0 };
	}

	return { exists: true, frontmatter: match[1] ?? '', contentStart: match[0].length };
}

export function parseYaml(yaml: string): unknown {
	const fields: Record<string, unknown> = {};

	for (const line of yaml.split('\n')) {
		const separator = line.indexOf(':');

		if (separator < 0) {
			continue;
		}

		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim();

		fields[key] = /^-?\d+$/.test(value) ? Number(value) : value.replace(/^["']|["']$/g, '');
	}

	return fields;
}

export function stringifyYaml(value: unknown): string {
	return Object.entries(value as Record<string, unknown>)
		.map(([key, field]) => `${key}: ${String(field)}\n`)
		.join('');
}

export class Plugin {
	loadData = vi.fn();
	saveData = vi.fn();
	addSettingTab = vi.fn();
	addCommand = vi.fn();
	registerObsidianProtocolHandler = vi.fn();
	registerEvent = vi.fn();
	registerInterval = vi.fn();

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

export const shownNotices: string[] = [];

export class Notice {
	constructor(readonly message: string) {
		shownNotices.push(message);
	}
}
