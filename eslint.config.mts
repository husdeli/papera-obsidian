import { defineConfig, globalIgnores } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import { PlainTextParser } from 'eslint-plugin-obsidianmd/dist/lib/plainTextParser.js';
import tseslint from 'typescript-eslint';

const restrictedGlobals = [
	{ name: 'app', message: 'Use the plugin instance instead of the global app object.' },
	{ name: 'localStorage', message: 'Use loadData and saveData through PaperaSettingsStore.' },
	{ name: 'fetch', message: 'Use paperaHttpClient, which wraps requestUrl.' },
	{ name: 'XMLHttpRequest', message: 'Use paperaHttpClient, which wraps requestUrl.' },
	{ name: 'WebSocket', message: 'Use paperaHttpClient, which wraps requestUrl.' },
];

export default defineConfig([
	globalIgnores([
		'node_modules',
		'main.js',
		'*.map',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'tsconfig.node.json',
		'versions.json',
	]),
	{
		files: ['src/**/*.ts'],
		extends: [obsidianmd.configs.recommended],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'obsidianmd/no-nodejs-modules': 'error',
			'no-restricted-globals': ['error', ...restrictedGlobals],
		},
	},
	{
		files: ['manifest.json'],
		plugins: { obsidianmd },
		languageOptions: {
			parser: tseslint.parser,
		},
		rules: {
			'obsidianmd/validate-manifest': 'error',
		},
	},
	{
		files: ['LICENSE'],
		plugins: { obsidianmd },
		languageOptions: {
			parser: PlainTextParser,
		},
		rules: {
			'obsidianmd/validate-license': 'error',
		},
	},
	{
		files: ['eslint.config.mts', 'esbuild.config.ts', 'vitest.config.ts', 'scripts/**/*.ts', 'test/**/*.ts'],
		extends: [tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.node.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
]);
