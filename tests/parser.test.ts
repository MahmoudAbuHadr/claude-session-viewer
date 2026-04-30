import {describe, expect, it} from 'vitest';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
	FileNotFoundError,
	MalformedSessionError,
	parseSession,
} from '../src/parser.js';
import type {TextBlock, ThinkingBlock, ToolUseBlock} from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => join(here, 'fixtures', name);

describe('parseSession', () => {
	it('parses a single-turn session with one text reply', async () => {
		const session = await parseSession(fixture('simple-session.jsonl'));

		expect(session.sessionId).toBe('s1');
		expect(session.cwd).toBe('/tmp/proj');
		expect(session.turns).toHaveLength(1);

		const turn = session.turns[0]!;
		expect(turn.prompt.display).toBe('hello');
		expect(turn.prompt.isSlashCommand).toBe(false);
		expect(turn.assistantBlocks).toHaveLength(1);
		expect(turn.assistantBlocks[0]!.type).toBe('text');
		expect((turn.assistantBlocks[0] as TextBlock).text).toBe('hi there');
		expect(turn.toolResults.size).toBe(0);
	});

	it('groups two turns, wires tool_results, and filters system/attachment/sidechain', async () => {
		const session = await parseSession(fixture('with-tools.jsonl'));

		expect(session.turns).toHaveLength(2);

		const t0 = session.turns[0]!;
		expect(t0.prompt.display).toBe('read foo.txt');
		// tool_use + the assistant's follow-up text after the tool_result
		expect(t0.assistantBlocks).toHaveLength(2);
		const toolUse = t0.assistantBlocks[0] as ToolUseBlock;
		expect(toolUse.type).toBe('tool_use');
		expect(toolUse.name).toBe('Read');
		expect(t0.assistantBlocks[1]!.type).toBe('text');
		expect(t0.toolResults.size).toBe(1);
		expect(t0.toolResults.get('tool_1')?.content).toBe('file contents');

		const t1 = session.turns[1]!;
		expect(t1.prompt.display).toBe('thanks');
		expect(t1.assistantBlocks).toHaveLength(1);
		expect(t1.assistantBlocks[0]!.type).toBe('text');
		expect(t1.toolResults.size).toBe(0);
	});

	it('parses a slash-command turn with thinking and AskUserQuestion blocks', async () => {
		const session = await parseSession(fixture('with-slash-and-thinking.jsonl'));

		expect(session.turns).toHaveLength(1);
		const turn = session.turns[0]!;

		expect(turn.prompt.isSlashCommand).toBe(true);
		expect(turn.prompt.display).toBe('/review main');
		expect(turn.prompt.stdout).toBe('📋 reviewing');

		const types = turn.assistantBlocks.map(b => b.type);
		expect(types).toEqual(['thinking', 'text', 'tool_use']);

		const thinking = turn.assistantBlocks[0] as ThinkingBlock;
		expect(thinking.thinking).toBe('Considering the request...');

		const tool = turn.assistantBlocks[2] as ToolUseBlock;
		expect(tool.name).toBe('AskUserQuestion');
		expect(turn.toolResults.get(tool.id)?.content).toBe('A');
	});

	it('rejects with FileNotFoundError when the path does not exist', async () => {
		await expect(
			parseSession('/nonexistent/path/foo.jsonl'),
		).rejects.toBeInstanceOf(FileNotFoundError);
	});

	it('rejects with MalformedSessionError on invalid JSON', async () => {
		await expect(parseSession(fixture('malformed.jsonl'))).rejects.toBeInstanceOf(
			MalformedSessionError,
		);
	});
});
