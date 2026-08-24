import { builtinModules } from 'node:module';

const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\/]/g;

function specifierPattern(specifier: string): RegExp {
	const escaped = specifier.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&');

	return new RegExp(
		String.raw`(?:require|import)\s*\(\s*['"]${escaped}['"]\s*\)` +
			String.raw`|(?:from|import)\s*['"]${escaped}['"]`,
	);
}

export function findNodeBuiltinImports(bundle: string): string[] {
	const specifiers = builtinModules.flatMap((name) =>
		name.startsWith('node:') ? [name] : [name, `node:${name}`],
	);

	return specifiers.filter((specifier) => specifierPattern(specifier).test(bundle));
}
