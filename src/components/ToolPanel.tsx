import React from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import type {
	ToolResultBlock,
	ToolResultContent,
	ToolUseBlock,
} from '../types.js';

const MAX_RESULT_LINES = 30;

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
	const isError = result?.is_error === true;
	const isAskUserQuestion =
		toolUse.name === 'AskUserQuestion' &&
		isAskQuestionArray(toolUse.input.questions);

	return (
		<Box flexDirection="column" borderStyle="round" paddingX={1}>
			<Text color="cyan">{header}</Text>
			{isAskUserQuestion && (
				<AskUserQuestionBody
					questions={toolUse.input.questions as AskQuestion[]}
				/>
			)}
			{status === 'running' && (
				<Box>
					<Text color="gray">
						<Spinner type="dots" /> Running...
					</Text>
				</Box>
			)}
			{status === 'done' && result && (
				<ResultBody
					content={flattenResult(result.content)}
					isError={isError}
				/>
			)}
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
				<Box key={qi} flexDirection="column" marginBottom={qi < questions.length - 1 ? 1 : 0}>
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

interface ResultBodyProps {
	content: string;
	isError: boolean;
}

const ResultBody: React.FC<ResultBodyProps> = ({content, isError}) => {
	const lines = content.split('\n');
	const truncated = lines.length > MAX_RESULT_LINES;
	const shown = truncated ? lines.slice(0, MAX_RESULT_LINES) : lines;
	const remaining = lines.length - MAX_RESULT_LINES;

	return (
		<Box flexDirection="column">
			<Text color={isError ? 'red' : undefined}>{shown.join('\n')}</Text>
			{truncated && <Text color="gray">… +{remaining} lines</Text>}
		</Box>
	);
};
