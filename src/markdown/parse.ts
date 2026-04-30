import {marked, type Token, type Tokens} from 'marked';
import type {
	MarkdownDoc,
	MdBlock,
	MdInline,
	MdListItem,
	MdTable,
	TableRange,
} from './types.js';

export function parseMarkdown(text: string): MarkdownDoc {
	if (text.length === 0) return {blocks: [], tableRanges: []};

	let tokens: Token[];
	try {
		tokens = marked.lexer(text);
	} catch {
		return fallback(text);
	}

	const blocks: MdBlock[] = [];
	const tableRanges: TableRange[] = [];
	let offset = 0;

	for (const tok of tokens) {
		const start = offset;
		const raw = (tok as {raw?: string}).raw ?? '';
		offset += raw.length;
		const block = normalizeBlock(tok);
		if (!block) continue;
		blocks.push(block);
		if (block.type === 'table') {
			tableRanges.push({start, end: offset, block});
		}
	}

	return {blocks, tableRanges};
}

function fallback(text: string): MarkdownDoc {
	return {
		blocks: [{type: 'paragraph', inlines: [{type: 'text', text}]}],
		tableRanges: [],
	};
}

function normalizeBlock(tok: Token): MdBlock | null {
	switch (tok.type) {
		case 'heading': {
			const t = tok as Tokens.Heading;
			const depth = clampDepth(t.depth);
			return {type: 'heading', depth, inlines: normalizeInlines(t.tokens)};
		}
		case 'paragraph': {
			const t = tok as Tokens.Paragraph;
			return {type: 'paragraph', inlines: normalizeInlines(t.tokens)};
		}
		case 'list': {
			const t = tok as Tokens.List;
			return {
				type: 'list',
				ordered: t.ordered === true,
				start: typeof t.start === 'number' ? t.start : 1,
				items: t.items.map(normalizeListItem),
			};
		}
		case 'code': {
			const t = tok as Tokens.Code;
			return {
				type: 'code',
				lang: typeof t.lang === 'string' && t.lang.length > 0 ? t.lang : null,
				text: t.text,
			};
		}
		case 'blockquote': {
			const t = tok as Tokens.Blockquote;
			const inner: MdBlock[] = [];
			for (const child of t.tokens ?? []) {
				const block = normalizeBlock(child);
				if (block) inner.push(block);
			}
			return {type: 'blockquote', blocks: inner};
		}
		case 'hr':
			return {type: 'hr'};
		case 'table': {
			const t = tok as Tokens.Table;
			const header = t.header.map(cell => normalizeInlines(cell.tokens));
			const rows = t.rows.map(row =>
				row.map(cell => normalizeInlines(cell.tokens)),
			);
			const table: MdTable = {
				type: 'table',
				align: t.align,
				header,
				rows,
			};
			return table;
		}
		case 'space':
		case 'html':
			return null;
		default: {
			const raw = (tok as {raw?: string}).raw;
			if (typeof raw === 'string' && raw.trim().length > 0) {
				return {type: 'paragraph', inlines: [{type: 'text', text: raw}]};
			}
			return null;
		}
	}
}

function normalizeListItem(item: Tokens.ListItem): MdListItem {
	const blocks: MdBlock[] = [];
	for (const child of item.tokens ?? []) {
		// Marked wraps tight-list inline content inside a top-level `text`
		// block-token whose own `tokens` field carries the inline tokens.
		// Recognize it and emit a paragraph block from those inlines.
		if (
			child.type === 'text' &&
			Array.isArray((child as Tokens.Text).tokens)
		) {
			const inner = (child as Tokens.Text).tokens;
			if (inner && inner.length > 0) {
				blocks.push({type: 'paragraph', inlines: normalizeInlines(inner)});
				continue;
			}
		}
		const block = normalizeBlock(child);
		if (block) blocks.push(block);
	}
	return {
		blocks,
		task: item.task === true,
		checked: item.checked === true,
	};
}

function normalizeInlines(tokens: Token[] | undefined): MdInline[] {
	if (!tokens) return [];
	const out: MdInline[] = [];
	for (const tok of tokens) {
		const inline = normalizeInline(tok);
		if (inline) out.push(inline);
	}
	return out;
}

function normalizeInline(tok: Token): MdInline | null {
	switch (tok.type) {
		case 'text':
		case 'escape': {
			const t = tok as Tokens.Text;
			// `marked` sometimes nests inline tokens inside a `text` token's own
			// `tokens` field. When present, those are the real inlines.
			if (Array.isArray(t.tokens) && t.tokens.length > 0) {
				const nested = normalizeInlines(t.tokens);
				if (nested.length === 1) return nested[0]!;
				if (nested.length > 1) {
					return {type: 'text', text: nested.map(plainOf).join('')};
				}
			}
			return {type: 'text', text: t.text};
		}
		case 'strong': {
			const t = tok as Tokens.Strong;
			return {type: 'strong', children: normalizeInlines(t.tokens)};
		}
		case 'em': {
			const t = tok as Tokens.Em;
			return {type: 'em', children: normalizeInlines(t.tokens)};
		}
		case 'codespan': {
			const t = tok as Tokens.Codespan;
			return {type: 'codespan', text: t.text};
		}
		case 'link': {
			const t = tok as Tokens.Link;
			return {
				type: 'link',
				href: t.href,
				children: normalizeInlines(t.tokens),
			};
		}
		case 'del': {
			const t = tok as Tokens.Del;
			return {type: 'del', children: normalizeInlines(t.tokens)};
		}
		case 'br':
			return {type: 'br'};
		case 'image': {
			// No image rendering in terminal — fall back to alt text.
			const t = tok as Tokens.Image;
			return {type: 'text', text: t.text};
		}
		case 'html': {
			const raw = (tok as {raw?: string}).raw;
			return typeof raw === 'string' ? {type: 'text', text: raw} : null;
		}
		default: {
			const raw = (tok as {raw?: string}).raw;
			const text = (tok as {text?: string}).text;
			if (typeof raw === 'string') return {type: 'text', text: raw};
			if (typeof text === 'string') return {type: 'text', text};
			return null;
		}
	}
}

function plainOf(inline: MdInline): string {
	switch (inline.type) {
		case 'text':
			return inline.text;
		case 'codespan':
			return inline.text;
		case 'br':
			return '\n';
		case 'strong':
		case 'em':
		case 'link':
		case 'del':
			return inline.children.map(plainOf).join('');
	}
}

function clampDepth(depth: number): 1 | 2 | 3 | 4 | 5 | 6 {
	if (depth <= 1) return 1;
	if (depth >= 6) return 6;
	return depth as 1 | 2 | 3 | 4 | 5 | 6;
}
