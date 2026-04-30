import React from 'react';
import {Box, Text, useStdout} from 'ink';
import type {
	MarkdownDoc,
	MdBlock,
	MdHeading,
	MdParagraph,
	MdList,
	MdListItem,
	MdCode,
	MdBlockquote,
	MdTable,
	MdInline,
} from './types.js';

interface RenderedMarkdownProps {
	doc: MarkdownDoc;
}

export function RenderedMarkdown({doc}: RenderedMarkdownProps): React.ReactElement | null {
	if (doc.blocks.length === 0) return null;
	return (
		<Box flexDirection="column">
			{doc.blocks.map((block, i) => (
				<RenderedBlock key={i} block={block} />
			))}
		</Box>
	);
}

interface RenderedBlockProps {
	block: MdBlock;
}

function RenderedBlock({block}: RenderedBlockProps): React.ReactElement | null {
	switch (block.type) {
		case 'heading':
			return <BlockHeading block={block} />;
		case 'paragraph':
			return <BlockParagraph block={block} />;
		case 'list':
			return <BlockList block={block} />;
		case 'code':
			return <BlockCode block={block} />;
		case 'blockquote':
			return <BlockBlockquote block={block} />;
		case 'hr':
			return <BlockHr />;
		case 'table':
			return <BlockTable block={block} />;
	}
}

interface BlockHeadingProps {
	block: MdHeading;
}

function BlockHeading({block}: BlockHeadingProps): React.ReactElement {
	const color = block.depth <= 2 ? 'cyan' : undefined;
	const prefix = '#'.repeat(block.depth) + ' ';
	return (
		<Text bold color={color}>
			{prefix}
			{renderInline(block.inlines)}
		</Text>
	);
}

interface BlockParagraphProps {
	block: MdParagraph;
}

function BlockParagraph({block}: BlockParagraphProps): React.ReactElement {
	return <Text>{renderInline(block.inlines)}</Text>;
}

interface BlockListProps {
	block: MdList;
	depth?: number;
}

function BlockList({block, depth = 0}: BlockListProps): React.ReactElement {
	return (
		<Box flexDirection="column">
			{block.items.map((item, i) => (
				<ListItemRow
					key={i}
					item={item}
					marker={markerFor(block, i)}
					indent={depth}
				/>
			))}
		</Box>
	);
}

function markerFor(list: MdList, index: number): string {
	if (list.ordered) return `${list.start + index}. `;
	return '• ';
}

interface ListItemRowProps {
	item: MdListItem;
	marker: string;
	indent: number;
}

function ListItemRow({item, marker, indent}: ListItemRowProps): React.ReactElement {
	const blocks = item.blocks;
	const first = blocks[0];
	const taskBox = item.task ? (item.checked ? '[x] ' : '[ ] ') : '';
	const indentStr = '  '.repeat(indent);

	const firstLine = ((): React.ReactNode => {
		if (first?.type === 'paragraph') {
			return (
				<Text>
					{indentStr}
					{marker}
					{taskBox}
					{renderInline(first.inlines)}
				</Text>
			);
		}
		return (
			<Text>
				{indentStr}
				{marker}
				{taskBox}
			</Text>
		);
	})();

	const restBlocks: React.ReactNode[] = [];
	const startFromZero = first?.type === 'paragraph' ? 1 : 0;
	for (let i = startFromZero; i < blocks.length; i++) {
		const block = blocks[i]!;
		if (block.type === 'list') {
			restBlocks.push(<BlockList key={i} block={block} depth={indent + 1} />);
		} else {
			restBlocks.push(
				<Box key={i} paddingLeft={(indent + 1) * 2}>
					<RenderedBlock block={block} />
				</Box>,
			);
		}
	}

	if (restBlocks.length === 0) return firstLine as React.ReactElement;
	return (
		<Box flexDirection="column">
			{firstLine}
			{restBlocks}
		</Box>
	);
}

interface BlockCodeProps {
	block: MdCode;
}

function BlockCode({block}: BlockCodeProps): React.ReactElement {
	const lines = block.text.replace(/\n+$/, '').split('\n');
	return (
		<Box flexDirection="column" paddingLeft={2}>
			{lines.map((line, i) => (
				<Text key={i} color="gray" dimColor>
					{line.length === 0 ? ' ' : line}
				</Text>
			))}
		</Box>
	);
}

interface BlockBlockquoteProps {
	block: MdBlockquote;
}

function BlockBlockquote({block}: BlockBlockquoteProps): React.ReactElement {
	return (
		<Box flexDirection="row">
			<Box flexDirection="column" marginRight={1}>
				{block.blocks.map((_, i) => (
					<Text key={i} color="gray" dimColor>
						│
					</Text>
				))}
			</Box>
			<Box flexDirection="column">
				{block.blocks.map((b, i) => (
					<RenderedBlock key={i} block={b} />
				))}
			</Box>
		</Box>
	);
}

function BlockHr(): React.ReactElement {
	const {stdout} = useStdout();
	const width = Math.min(80, Math.max(20, stdout?.columns ?? 40));
	return (
		<Text color="gray" dimColor>
			{'─'.repeat(width)}
		</Text>
	);
}

interface BlockTableProps {
	block: MdTable;
}

function BlockTable({block}: BlockTableProps): React.ReactElement {
	const widths = computeColumnWidths(block);
	const renderRow = (
		cells: MdInline[][],
		key: string,
		bold: boolean,
	): React.ReactElement => {
		const parts: React.ReactNode[] = [];
		cells.forEach((cell, ci) => {
			const text = inlineToPlain(cell);
			const align = block.align[ci] ?? 'left';
			const padTotal = Math.max(0, widths[ci]! - text.length);
			let leftPad = 0;
			let rightPad = 0;
			if (align === 'right') {
				leftPad = padTotal;
			} else if (align === 'center') {
				leftPad = Math.floor(padTotal / 2);
				rightPad = padTotal - leftPad;
			} else {
				rightPad = padTotal;
			}
			if (leftPad > 0) parts.push(' '.repeat(leftPad));
			parts.push(
				<React.Fragment key={ci}>
					{bold ? (
						<Text bold>{renderInline(cell)}</Text>
					) : (
						renderInline(cell)
					)}
				</React.Fragment>,
			);
			if (rightPad > 0) parts.push(' '.repeat(rightPad));
			if (ci < cells.length - 1) parts.push('  ');
		});
		return <Text key={key}>{parts}</Text>;
	};

	const separator = (
		<Text key="sep" color="gray" dimColor>
			{widths.map((w, i) => (
				<React.Fragment key={i}>
					{'─'.repeat(w)}
					{i < widths.length - 1 ? '  ' : ''}
				</React.Fragment>
			))}
		</Text>
	);

	return (
		<Box flexDirection="column">
			{renderRow(block.header, 'h', true)}
			{separator}
			{block.rows.map((row, ri) => renderRow(row, `r${ri}`, false))}
		</Box>
	);
}

function computeColumnWidths(table: MdTable): number[] {
	const cols = table.header.length;
	const widths = new Array<number>(cols).fill(0);
	for (let c = 0; c < cols; c++) {
		widths[c] = inlineToPlain(table.header[c] ?? []).length;
	}
	for (const row of table.rows) {
		for (let c = 0; c < cols; c++) {
			const cell = row[c];
			if (!cell) continue;
			const len = inlineToPlain(cell).length;
			if (len > widths[c]!) widths[c] = len;
		}
	}
	return widths;
}

function inlineToPlain(inlines: MdInline[]): string {
	return inlines
		.map(i => {
			switch (i.type) {
				case 'text':
					return i.text;
				case 'codespan':
					return '`' + i.text + '`';
				case 'br':
					return ' ';
				case 'strong':
				case 'em':
				case 'del':
					return inlineToPlain(i.children);
				case 'link':
					return inlineToPlain(i.children);
			}
		})
		.join('');
}

function renderInline(inlines: MdInline[]): React.ReactNode {
	return inlines.map((inline, i) => (
		<React.Fragment key={i}>{renderOne(inline)}</React.Fragment>
	));
}

function renderOne(inline: MdInline): React.ReactNode {
	switch (inline.type) {
		case 'text':
			return inline.text;
		case 'br':
			return '\n';
		case 'strong':
			return <Text bold>{renderInline(inline.children)}</Text>;
		case 'em':
			return <Text italic>{renderInline(inline.children)}</Text>;
		case 'del':
			return <Text strikethrough>{renderInline(inline.children)}</Text>;
		case 'codespan':
			return <Text color="yellow">{'`' + inline.text + '`'}</Text>;
		case 'link': {
			const visible = inlineToPlain(inline.children);
			const showHref = inline.href && inline.href !== visible;
			return (
				<>
					<Text color="blue" underline>
						{renderInline(inline.children)}
					</Text>
					{showHref ? (
						<Text color="gray" dimColor>
							{` (${inline.href})`}
						</Text>
					) : null}
				</>
			);
		}
	}
}
