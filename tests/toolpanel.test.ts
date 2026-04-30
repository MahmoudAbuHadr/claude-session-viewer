import {describe, expect, it} from 'vitest';
import {summarizeArgs} from '../src/components/ToolPanel.js';

describe('summarizeArgs', () => {
	it('uses preferred string keys', () => {
		expect(summarizeArgs('Read', {file_path: '/tmp/foo.txt'})).toBe(
			'/tmp/foo.txt',
		);
	});

	it('summarizes AskUserQuestion by joining question headers', () => {
		const input = {
			questions: [
				{header: 'Env var name', question: 'Which env variable name?'},
				{header: 'Scope', question: 'Apply to which callbacks?'},
			],
		};
		expect(summarizeArgs('AskUserQuestion', input)).toBe(
			'Env var name, Scope',
		);
	});

	it('falls back to question text when AskUserQuestion lacks a header', () => {
		const input = {questions: [{question: 'Pick one'}]};
		expect(summarizeArgs('AskUserQuestion', input)).toBe('Pick one');
	});

	it('does not produce [object Object] for nested object/array values', () => {
		const out = summarizeArgs('Weird', {payload: {a: 1}, nested: [{b: 2}]});
		expect(out).not.toContain('[object Object]');
	});

	it('returns empty string when no primitive values exist', () => {
		expect(summarizeArgs('Weird', {payload: {a: 1}})).toBe('');
	});

	it('uses primitive non-preferred keys when no preferred match exists', () => {
		expect(summarizeArgs('Custom', {count: 3})).toBe('count: 3');
	});
});
