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

function summarizeArgs(input: Record<string, unknown>): string {
	for (const key of PREFERRED_ARG_KEYS) {
		const value = input[key];
		if (typeof value === 'string') return truncate(value, 60);
	}
	const keys = Object.keys(input);
	if (keys.length === 0) return '';
	const firstKey = keys[0]!;
	return `${firstKey}: ${truncate(String(input[firstKey]), 50)}`;
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
	const header = `⏺ ${toolUse.name}(${summarizeArgs(toolUse.input)})`;
	const isError = result?.is_error === true;

	return (
		<Box flexDirection="column" borderStyle="round" paddingX={1}>
			<Text color="cyan">{header}</Text>
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
