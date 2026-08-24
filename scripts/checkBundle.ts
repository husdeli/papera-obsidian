import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { findNodeBuiltinImports } from './findNodeBuiltinImports';

const bundlePath = 'main.js';
const bundle = await readFile(bundlePath, 'utf8');
const builtins = findNodeBuiltinImports(bundle);

if (builtins.length > 0) {
	console.error(
		`${bundlePath} imports Node built-in modules, which break the plugin on mobile: ${builtins.join(', ')}`,
	);
	process.exit(1);
}

console.log(`${bundlePath} imports no Node built-in module.`);
