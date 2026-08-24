import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		alias: {
			obsidian: path.resolve(import.meta.dirname, 'test/stubs/obsidian.ts'),
		},
	},
});
