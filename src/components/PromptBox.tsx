import React from 'react';
import {Box, Text} from 'ink';
import type {RenderedPrompt} from '../types.js';

interface PromptBoxProps {
	prompt: RenderedPrompt | null;
	cwd: string;
	hint?: string;
}

export const PromptBox: React.FC<PromptBoxProps> = ({prompt, cwd, hint}) => {
	const text = prompt?.display ?? '';
	return (
		<Box flexDirection="column" marginTop={1}>
			<Box borderStyle="round" paddingX={1}>
				<Text color="gray">{'> '}</Text>
				<Text>{text || ' '}</Text>
			</Box>
			<Box paddingLeft={2}>
				<Text color="gray" dimColor>
					{cwd}
					{hint ? `   ${hint}` : ''}
				</Text>
			</Box>
		</Box>
	);
};
