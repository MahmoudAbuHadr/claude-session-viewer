import React, {useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import type {SessionSummary} from '../sessions.js';

interface PickerProps {
	sessions: SessionSummary[];
	onPick: (session: SessionSummary) => void;
}

const PAGE_SIZE = 10;

function basenameOfCwd(cwd: string): string {
	if (!cwd) return '';
	const parts = cwd.split('/').filter(Boolean);
	return parts[parts.length - 1] ?? cwd;
}

export const Picker: React.FC<PickerProps> = ({sessions, onPick}) => {
	const [highlight, setHighlight] = useState(0);
	const {exit} = useApp();

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
			return;
		}
		if (input === 'q' || key.escape) {
			exit();
			return;
		}
		if (key.upArrow) {
			setHighlight(h => Math.max(0, h - 1));
		}
		if (key.downArrow) {
			setHighlight(h => Math.min(sessions.length - 1, h + 1));
		}
		if (key.return) {
			const picked = sessions[highlight];
			if (picked) onPick(picked);
		}
	});

	const windowStart = Math.max(
		0,
		Math.min(
			Math.max(0, sessions.length - PAGE_SIZE),
			highlight - Math.floor(PAGE_SIZE / 2),
		),
	);
	const windowEnd = Math.min(sessions.length, windowStart + PAGE_SIZE);
	const visible = sessions.slice(windowStart, windowEnd);

	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold>Recent Claude Code sessions ({sessions.length})</Text>
			<Box flexDirection="column" marginTop={1}>
				{visible.map((session, idx) => {
					const realIdx = windowStart + idx;
					const isActive = realIdx === highlight;
					const project = basenameOfCwd(session.cwd);
					return (
						<Box key={session.id}>
							<Text color={isActive ? 'cyan' : undefined}>
								{isActive ? '▸ ' : '  '}
							</Text>
							<Text color={isActive ? 'cyan' : undefined}>
								{project ? `[${project}] ` : ''}
								{session.firstPrompt}
							</Text>
						</Box>
					);
				})}
			</Box>
			<Box marginTop={1}>
				<Text dimColor>↑↓ navigate   ↵ pick   q quit</Text>
			</Box>
		</Box>
	);
};
