import {describe, expect, it, vi} from 'vitest';
import {parseMarkdown} from '../src/markdown/parse.js';
import type {MdInline} from '../src/markdown/types.js';

const plain = (inlines: MdInline[]): string =>
	inlines
		.map(i => {
			if (i.type === 'text' || i.type === 'codespan') return i.text;
			if (i.type === 'br') return '\n';
			return plain(i.children);
		})
		.join('');

describe('parseMarkdown', () => {
	it('returns an empty doc for empty input', () => {
		const doc = parseMarkdown('');
		expect(doc).toEqual({blocks: [], tableRanges: []});
	});

	it('parses plain text as a single paragraph', () => {
		const doc = parseMarkdown('hello world');
		expect(doc.blocks).toHaveLength(1);
		const block = doc.blocks[0]!;
		expect(block.type).toBe('paragraph');
		if (block.type !== 'paragraph') return;
		expect(plain(block.inlines)).toBe('hello world');
		expect(doc.tableRanges).toEqual([]);
	});

	it('parses a heading with the right depth', () => {
		const doc = parseMarkdown('# Hi');
		expect(doc.blocks).toHaveLength(1);
		const block = doc.blocks[0]!;
		expect(block.type).toBe('heading');
		if (block.type !== 'heading') return;
		expect(block.depth).toBe(1);
		expect(plain(block.inlines)).toBe('Hi');
	});

	it('parses inline tokens (strong, em, codespan, link)', () => {
		const doc = parseMarkdown(
			'mix **bold** and *italic* and `code` and [a link](https://x).',
		);
		expect(doc.blocks).toHaveLength(1);
		const block = doc.blocks[0]!;
		if (block.type !== 'paragraph') throw new Error('expected paragraph');
		const types = block.inlines.map(i => i.type);
		expect(types).toContain('strong');
		expect(types).toContain('em');
		expect(types).toContain('codespan');
		expect(types).toContain('link');
		const link = block.inlines.find(i => i.type === 'link');
		if (link?.type !== 'link') throw new Error('expected link');
		expect(link.href).toBe('https://x');
	});

	it('parses a tight unordered list', () => {
		const doc = parseMarkdown('- a\n- b\n');
		expect(doc.blocks).toHaveLength(1);
		const block = doc.blocks[0]!;
		if (block.type !== 'list') throw new Error('expected list');
		expect(block.ordered).toBe(false);
		expect(block.items).toHaveLength(2);
		const firstItemBlocks = block.items[0]!.blocks;
		expect(firstItemBlocks[0]?.type).toBe('paragraph');
	});

	it('parses an ordered list with start index', () => {
		const doc = parseMarkdown('3. first\n4. second\n');
		const block = doc.blocks[0]!;
		if (block.type !== 'list') throw new Error('expected list');
		expect(block.ordered).toBe(true);
		expect(block.start).toBe(3);
		expect(block.items).toHaveLength(2);
	});

	it('parses a fenced code block with language', () => {
		const doc = parseMarkdown('```js\nconst x = 1;\n```');
		const block = doc.blocks[0]!;
		if (block.type !== 'code') throw new Error('expected code');
		expect(block.lang).toBe('js');
		expect(block.text).toBe('const x = 1;');
	});

	it('parses a blockquote containing a paragraph', () => {
		const doc = parseMarkdown('> hello\n');
		const block = doc.blocks[0]!;
		if (block.type !== 'blockquote') throw new Error('expected blockquote');
		expect(block.blocks[0]?.type).toBe('paragraph');
	});

	it('parses a horizontal rule', () => {
		const doc = parseMarkdown('foo\n\n---\n\nbar');
		const types = doc.blocks.map(b => b.type);
		expect(types).toContain('hr');
	});

	it('parses a simple GFM table and records its source range', () => {
		const src = '| a | b |\n|---|---|\n| 1 | 2 |\n';
		const doc = parseMarkdown(src);
		expect(doc.blocks).toHaveLength(1);
		const block = doc.blocks[0]!;
		if (block.type !== 'table') throw new Error('expected table');
		expect(block.header).toHaveLength(2);
		expect(plain(block.header[0]!)).toBe('a');
		expect(plain(block.header[1]!)).toBe('b');
		expect(block.rows).toEqual([
			[
				expect.any(Array),
				expect.any(Array),
			],
		]);
		expect(plain(block.rows[0]![0]!)).toBe('1');
		expect(plain(block.rows[0]![1]!)).toBe('2');
		expect(doc.tableRanges).toHaveLength(1);
		const range = doc.tableRanges[0]!;
		expect(range.start).toBe(0);
		expect(range.end).toBe(src.length);
		expect(range.block).toBe(block);
	});

	it('parses table alignment markers', () => {
		const doc = parseMarkdown('| a | b |\n|:--|--:|\n| 1 | 2 |\n');
		const block = doc.blocks[0]!;
		if (block.type !== 'table') throw new Error('expected table');
		expect(block.align).toEqual(['left', 'right']);
	});

	it('records correct source range when text precedes the table', () => {
		const prelude = 'prelude\n\n';
		const tableSrc = '| a |\n|---|\n| 1 |\n';
		const src = prelude + tableSrc;
		const doc = parseMarkdown(src);
		expect(doc.blocks).toHaveLength(2);
		expect(doc.blocks[0]?.type).toBe('paragraph');
		expect(doc.blocks[1]?.type).toBe('table');
		expect(doc.tableRanges).toHaveLength(1);
		const range = doc.tableRanges[0]!;
		// The slice at the recorded range should be the table source.
		expect(src.slice(range.start, range.end)).toBe(tableSrc);
	});

	it('records multiple tables in document order', () => {
		const src =
			'| a |\n|---|\n| 1 |\n\nbetween\n\n| x |\n|---|\n| y |\n';
		const doc = parseMarkdown(src);
		expect(doc.tableRanges).toHaveLength(2);
		expect(doc.tableRanges[0]!.start).toBeLessThan(doc.tableRanges[1]!.start);
		expect(src.slice(doc.tableRanges[0]!.start, doc.tableRanges[0]!.end))
			.toContain('| a |');
		expect(src.slice(doc.tableRanges[1]!.start, doc.tableRanges[1]!.end))
			.toContain('| x |');
	});

	it('falls back to a single paragraph when the lexer throws', async () => {
		const marked = await import('marked');
		const spy = vi.spyOn(marked.marked, 'lexer').mockImplementation(() => {
			throw new Error('boom');
		});
		try {
			const doc = parseMarkdown('anything');
			expect(doc.tableRanges).toEqual([]);
			expect(doc.blocks).toHaveLength(1);
			const block = doc.blocks[0]!;
			expect(block.type).toBe('paragraph');
			if (block.type !== 'paragraph') return;
			expect(plain(block.inlines)).toBe('anything');
		} finally {
			spy.mockRestore();
		}
	});
});
