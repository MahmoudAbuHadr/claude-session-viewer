import React from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import type {
	ToolResultBlock,
	ToolResultContent,
	ToolUseBlock,
} from '../types.js';

const PREFERRED_ARG_KEYS = [
	'file_path',
	'path',
	'command',
	'pattern',
	'url',
	'query',
	'description',
	'subagent_type',
];

function truncate(value: string, max: number): string {
	return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

interface AskQuestion {
	question?: string;
	header?: string;
	multiSelect?: boolean;
	options?: Array<{label?: string; description?: string}>;
}

function isAskQuestionArray(value: unknown): value is AskQuestion[] {
	return (
		Array.isArray(value) &&
		value.every(q => typeof q === 'object' && q !== null)
	);
}

export function summarizeArgs(
	name: string,
	input: Record<string, unknown>,
): string {
	if (name === 'AskUserQuestion' && isAskQuestionArray(input.questions)) {
		const headers = input.questions
			.map(q => q.header ?? q.question ?? '')
			.filter(Boolean)
			.map(h => truncate(h, 30));
		if (headers.length > 0) return headers.join(', ');
	}
	for (const key of PREFERRED_ARG_KEYS) {
		const value = input[key];
		if (typeof value === 'string') return truncate(value, 60);
	}
	for (const [key, value] of Object.entries(input)) {
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			return `${key}: ${truncate(String(value), 50)}`;
		}
	}
	return '';
}

function flattenResult(content: ToolResultContent): string {
	if (typeof content === 'string') return content;
	return content.map(part => part.text ?? '').join('');
}

function countLines(text: string): number {
	if (text.length === 0) return 0;
	return text.split('\n').length;
}

function firstNonEmptyLine(text: string): string {
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.length > 0) return trimmed;
	}
	return '';
}

export interface ResultSummary {
	line: string;
	isError: boolean;
}

export function summarizeResult(
	toolUse: ToolUseBlock,
	result: ToolResultBlock,
): ResultSummary {
	const content = flattenResult(result.content);
	const isError = result.is_error === true;

	if (isError) {
		return {
			line: `Error: ${truncate(firstNonEmptyLine(content) || 'tool failed', 60)}`,
			isError: true,
		};
	}

	const input = toolUse.input;
	switch (toolUse.name) {
		case 'Read': {
			const n = countLines(content);
			return {line: `Read ${n} lines (ctrl+r to expand)`, isError: false};
		}
		case 'Edit': {
			const replaceAll = input.replace_all === true;
			const n = replaceAll ? Math.max(1, countOccurrencesFromContent(content)) : 1;
			return {line: `Updated file with ${n} changes`, isError: false};
		}
		case 'Write': {
			const writtenContent =
				typeof input.content === 'string' ? input.content : '';
			const n = countLines(writtenContent);
			const path =
				typeof input.file_path === 'string' ? input.file_path : '';
			return {
				line: `Wrote ${n} lines to ${truncate(path, 40)}`,
				isError: false,
			};
		}
		case 'Bash': {
			const lines = content.split('\n').filter(l => l.length > 0);
			const head = lines.slice(0, 5).join(' · ');
			const more = lines.length > 5 ? `  … +${lines.length - 5} lines` : '';
			return {
				line: `exit 0${head ? `  ${truncate(head, 60)}` : ''}${more}`,
				isError: false,
			};
		}
		case 'Grep': {
			const found = content.match(/Found (\d+) match/);
			if (found) {
				const fileCount = (content.match(/^[^:\n]+:/gm) ?? []).length;
				return {
					line: `Found ${found[1]} matches${fileCount > 0 ? ` in ${fileCount} files` : ''}`,
					isError: false,
				};
			}
			if (/no matches/i.test(content)) {
				return {line: 'No matches found', isError: false};
			}
			const n = countLines(content);
			return {line: `${n} results`, isError: false};
		}
		default:
			return {
				line: truncate(firstNonEmptyLine(content), 60),
				isError: false,
			};
	}
}

function countOccurrencesFromContent(content: string): number {
	const m = content.match(/(\d+) (?:occurrences|replacements)/i);
	return m ? parseInt(m[1]!, 10) : 1;
}

interface ToolPanelProps {
	toolUse: ToolUseBlock;
	result: ToolResultBlock | null;
	status: 'running' | 'done';
}

export const ToolPanel: React.FC<ToolPanelProps> = ({
	toolUse,
	result,
	status,
}) => {
	const header = `⏺ ${toolUse.name}(${summarizeArgs(toolUse.name, toolUse.input)})`;
	const isAskUserQuestion =
		toolUse.name === 'AskUserQuestion' &&
		isAskQuestionArray(toolUse.input.questions);

	return (
		<Box flexDirection="column">
			<Text color="cyan">{header}</Text>
			{isAskUserQuestion && (
				<AskUserQuestionBody
					questions={toolUse.input.questions as AskQuestion[]}
				/>
			)}
			{!isAskUserQuestion && status === 'running' && (
				<Box paddingLeft={2}>
					<Text color="gray" dimColor>
						<Text>⎿ </Text>
						<Spinner type="dots" />
						<Text> Running…</Text>
					</Text>
				</Box>
			)}
			{!isAskUserQuestion && status === 'done' && result && (
				<SummaryLine summary={summarizeResult(toolUse, result)} />
			)}
		</Box>
	);
};

interface SummaryLineProps {
	summary: ResultSummary;
}

const SummaryLine: React.FC<SummaryLineProps> = ({summary}) => {
	return (
		<Box paddingLeft={2}>
			<Text color={summary.isError ? 'red' : 'gray'} dimColor={!summary.isError}>
				{`⎿  ${summary.line}`}
			</Text>
		</Box>
	);
};

interface AskUserQuestionBodyProps {
	questions: AskQuestion[];
}

const AskUserQuestionBody: React.FC<AskUserQuestionBodyProps> = ({
	questions,
}) => {
	return (
		<Box flexDirection="column" marginTop={1}>
			{questions.map((q, qi) => (
				<Box
					key={qi}
					flexDirection="column"
					marginBottom={qi < questions.length - 1 ? 1 : 0}
				>
					<Text bold>{q.question ?? q.header ?? ''}</Text>
					{q.options?.map((opt, oi) => (
						<Box key={oi} flexDirection="column">
							<Text color="green">{`  • ${opt.label ?? ''}`}</Text>
							{opt.description && (
								<Text color="gray">{`      ${opt.description}`}</Text>
							)}
						</Box>
					))}
				</Box>
			))}
		</Box>
	);
};
