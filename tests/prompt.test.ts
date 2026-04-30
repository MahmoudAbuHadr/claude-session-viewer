import {describe, expect, it} from 'vitest';
import {parsePrompt} from '../src/prompt.js';

describe('parsePrompt', () => {
	it('treats a plain string as the display text', () => {
		const result = parsePrompt('fix the auth bug');
		expect(result).toEqual({
			display: 'fix the auth bug',
			isSlashCommand: false,
			stdout: null,
		});
	});

	it('strips <system-reminder> noise from a plain prompt', () => {
		const raw = '<system-reminder>be careful</system-reminder>fix the auth bug';
		expect(parsePrompt(raw)).toEqual({
			display: 'fix the auth bug',
			isSlashCommand: false,
			stdout: null,
		});
	});

	it('parses a slash command with no args', () => {
		const raw =
			'<local-command-caveat>caveat text</local-command-caveat><command-name>reload-plugins</command-name><command-message>reload-plugins</command-message><command-args></command-args>';
		expect(parsePrompt(raw)).toEqual({
			display: '/reload-plugins',
			isSlashCommand: true,
			stdout: null,
		});
	});

	it('parses a slash command with args', () => {
		const raw =
			'<command-name>review</command-name><command-message>review</command-message><command-args>main</command-args>';
		expect(parsePrompt(raw)).toEqual({
			display: '/review main',
			isSlashCommand: true,
			stdout: null,
		});
	});

	it('captures <local-command-stdout> alongside the slash command', () => {
		const raw =
			'<command-name>foo</command-name><command-args></command-args><local-command-stdout>line1\nline2</local-command-stdout>';
		expect(parsePrompt(raw)).toEqual({
			display: '/foo',
			isSlashCommand: true,
			stdout: 'line1\nline2',
		});
	});

	it('returns empty display when stripping leaves nothing (caveat-only turn)', () => {
		const raw =
			'<local-command-caveat>Caveat: do not respond</local-command-caveat>';
		expect(parsePrompt(raw)).toEqual({
			display: '',
			isSlashCommand: false,
			stdout: null,
		});
	});

	it('strips a leading slash from <command-name> so we never produce //login', () => {
		const raw =
			'<command-name>/login</command-name><command-message>login</command-message><command-args></command-args>';
		expect(parsePrompt(raw)).toEqual({
			display: '/login',
			isSlashCommand: true,
			stdout: null,
		});
	});

	it('preserves prose around an embedded reminder', () => {
		const raw =
			'before<system-reminder>noise</system-reminder>after';
		const result = parsePrompt(raw);
		expect(result.isSlashCommand).toBe(false);
		expect(result.display).toBe('beforeafter');
	});

	it('never throws on malformed input', () => {
		expect(() => parsePrompt('<unclosed-tag')).not.toThrow();
		expect(() => parsePrompt('')).not.toThrow();
	});
});
