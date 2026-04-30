import {describe, expect, it} from 'vitest';
import {summarizeArgs, summarizeResult} from '../src/components/ToolPanel.js';
import type {ToolResultBlock, ToolUseBlock} from '../src/types.js';

const makeToolUse = (
	name: string,
	input: Record<string, unknown> = {},
): ToolUseBlock => ({type: 'tool_use', id: 't1', name, input});

const makeResult = (
	content: string,
	is_error = false,
): ToolResultBlock => ({type: 'tool_result', tool_use_id: 't1', content, is_error});

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

describe('summarizeResult', () => {
	it('Read: counts result lines and includes ctrl+r hint', () => {
		const result = makeResult('line1\nline2\nline3');
		expect(summarizeResult(makeToolUse('Read'), result)).toEqual({
			line: 'Read 3 lines (ctrl+r to expand)',
			isError: false,
		});
	});

	it('Edit: reports 1 change for non-replace_all (literal "1 changes" wording matches the design table)', () => {
		const result = makeResult('The file /tmp/foo.ts has been updated');
		expect(summarizeResult(makeToolUse('Edit'), result)).toEqual({
			line: 'Updated file with 1 changes',
			isError: false,
		});
	});

	it('Edit: parses replacement count for replace_all', () => {
		const result = makeResult('Replaced 7 occurrences in /tmp/foo.ts');
		const summary = summarizeResult(
			makeToolUse('Edit', {replace_all: true}),
			result,
		);
		expect(summary).toEqual({
			line: 'Updated file with 7 changes',
			isError: false,
		});
	});

	it('Write: reports written lines and truncated path', () => {
		const result = makeResult('File created');
		const written = 'a\nb\nc\n';
		const summary = summarizeResult(
			makeToolUse('Write', {file_path: '/tmp/foo.ts', content: written}),
			result,
		);
		expect(summary.line).toBe('Wrote 4 lines to /tmp/foo.ts');
	});

	it('Bash success: starts with exit 0 and includes head of stdout', () => {
		const result = makeResult('hello\nworld');
		const summary = summarizeResult(makeToolUse('Bash'), result);
		expect(summary.isError).toBe(false);
		expect(summary.line.startsWith('exit 0')).toBe(true);
		expect(summary.line).toContain('hello');
	});

	it('Bash with > 5 stdout lines appends "+M lines"', () => {
		const result = makeResult('1\n2\n3\n4\n5\n6\n7');
		const summary = summarizeResult(makeToolUse('Bash'), result);
		expect(summary.line).toMatch(/\+2 lines/);
	});

	it('Grep: parses Found N matches', () => {
		const result = makeResult('Found 12 matches\nfile1.ts:1:foo\nfile2.ts:3:foo');
		expect(summarizeResult(makeToolUse('Grep'), result)).toEqual({
			line: 'Found 12 matches in 2 files',
			isError: false,
		});
	});

	it('Grep: handles no-match output', () => {
		const result = makeResult('No matches found');
		expect(summarizeResult(makeToolUse('Grep'), result)).toEqual({
			line: 'No matches found',
			isError: false,
		});
	});

	it('Fallback: first non-empty line truncated for unknown tools', () => {
		const result = makeResult('\n\nfirst real line\nsecond');
		expect(summarizeResult(makeToolUse('Unknown'), result)).toEqual({
			line: 'first real line',
			isError: false,
		});
	});

	it('Error path: red Error prefix, isError=true', () => {
		const result = makeResult('something blew up\nstack trace', true);
		const summary = summarizeResult(makeToolUse('Read'), result);
		expect(summary.isError).toBe(true);
		expect(summary.line.startsWith('Error: ')).toBe(true);
		expect(summary.line).toContain('something blew up');
	});
});
