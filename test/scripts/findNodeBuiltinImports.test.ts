import { describe, expect, it } from 'vitest';
import { findNodeBuiltinImports } from '../../scripts/findNodeBuiltinImports';

describe('findNodeBuiltinImports', () => {
	it('reports a required Node built-in', () => {
		const bundle = 'var fs = require("fs");\nvar joined = fs.join("a", "path");\n';

		expect(findNodeBuiltinImports(bundle)).toContain('fs');
	});

	it('reports a node prefixed import', () => {
		const bundle = 'import { join } from "node:path";\n';

		expect(findNodeBuiltinImports(bundle)).toContain('node:path');
	});

	it('passes a bundle that only requires obsidian', () => {
		const bundle = 'var obsidian = require("obsidian");\nvar label = "path of os";\n';

		expect(findNodeBuiltinImports(bundle)).toEqual([]);
	});
});
