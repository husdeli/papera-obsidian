import { describe, expect, it } from 'vitest';
import {
	type PaperaLinkTarget,
	paperaLinkAddress,
} from '../../src/domain/paperaLinkAddress';

const ORIGIN = 'https://papera.dev';

describe('paperaLinkAddress', () => {
	describe('reading a URL', () => {
		it.each<[string, PaperaLinkTarget, string]>([
			['https://papera.dev/n/unit-1', 'contentUnit', 'unit-1'],
			['https://papera.dev/p/project-1', 'project', 'project-1'],
			['https://papera.dev/a/attachment-1', 'attachment', 'attachment-1'],
		])('reads %s as a %s address', (url, target, id) => {
			expect(paperaLinkAddress.read(ORIGIN, url)).toEqual({
				target,
				id,
				fragment: undefined,
			});
		});

		it('reads the heading fragment of a content unit address', () => {
			expect(paperaLinkAddress.read(ORIGIN, 'https://papera.dev/n/unit-1#Agenda%20one')).toEqual(
				{ target: 'contentUnit', id: 'unit-1', fragment: 'Agenda one' },
			);
		});

		it('decodes a percent-encoded id', () => {
			expect(paperaLinkAddress.read(ORIGIN, 'https://papera.dev/n/unit%201')?.id).toBe(
				'unit 1',
			);
		});

		it.each([
			['another host', 'https://example.com/n/unit-1'],
			['a host that shares a prefix', 'https://papera.dev.example.com/n/unit-1'],
			['a host that starts with the same characters', 'https://papera.developer/n/unit-1'],
			['another scheme', 'http://papera.dev/n/unit-1'],
			['another port', 'https://papera.dev:8443/n/unit-1'],
			['an unrecognised path prefix', 'https://papera.dev/x/unit-1'],
			['a path with one segment', 'https://papera.dev/n'],
			['a path with three segments', 'https://papera.dev/n/unit-1/extra'],
			['an empty id', 'https://papera.dev/n/'],
			['a URL carrying a query, which no wikilink can hold', 'https://papera.dev/n/unit-1?from=inbox'],
			['a vault-relative destination', 'Papera/Acme/Research/Kickoff notes.md'],
			['text that is no URL at all', 'not a url'],
		])('reads no address from %s', (_name, url) => {
			expect(paperaLinkAddress.read(ORIGIN, url)).toBeUndefined();
		});

		it('reads no address when the signed-in origin is no URL', () => {
			expect(paperaLinkAddress.read('papera.dev', 'https://papera.dev/n/unit-1')).toBeUndefined();
		});

		it('reads an address on the origin the vault is signed in to', () => {
			expect(
				paperaLinkAddress.read('https://papera.example.com', 'https://papera.example.com/n/unit-1'),
			).toEqual({ target: 'contentUnit', id: 'unit-1', fragment: undefined });
		});
	});

	describe('writing a URL', () => {
		it.each<[PaperaLinkTarget, string]>([
			['contentUnit', 'https://papera.dev/n/unit-1'],
			['project', 'https://papera.dev/p/unit-1'],
			['attachment', 'https://papera.dev/a/unit-1'],
		])('writes a %s address', (target, url) => {
			expect(paperaLinkAddress.write(ORIGIN, { target, id: 'unit-1' })).toBe(url);
		});

		it('writes a heading fragment as a percent-encoded URL fragment', () => {
			expect(
				paperaLinkAddress.write(ORIGIN, {
					target: 'contentUnit',
					id: 'unit-1',
					fragment: 'Agenda one',
				}),
			).toBe('https://papera.dev/n/unit-1#Agenda%20one');
		});

		it('drops the path of the signed-in origin', () => {
			expect(
				paperaLinkAddress.write('https://papera.dev/app/', {
					target: 'contentUnit',
					id: 'unit-1',
				}),
			).toBe('https://papera.dev/n/unit-1');
		});

		it('writes nothing when the signed-in origin is no URL', () => {
			expect(
				paperaLinkAddress.write('papera.dev', { target: 'contentUnit', id: 'unit-1' }),
			).toBeUndefined();
		});

		it('keeps a character a URL fragment allows', () => {
			expect(
				paperaLinkAddress.write(ORIGIN, {
					target: 'contentUnit',
					id: 'unit-1',
					fragment: 'A&B',
				}),
			).toBe('https://papera.dev/n/unit-1#A&B');
		});

		it.each([
			'https://papera.dev/n/unit-1#Agenda%20one',
			'https://papera.dev/n/unit-1#A&B',
		])('returns the address it read from %s', (url) => {
			const address = paperaLinkAddress.read(ORIGIN, url);

			expect(address).toBeDefined();
			expect(address && paperaLinkAddress.write(ORIGIN, address)).toBe(url);
		});
	});
});
