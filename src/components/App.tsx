import React, {useEffect, useRef, useState} from 'react';
import {Box, useApp, useInput} from 'ink';
import {Turn} from './Turn.js';
import {PromptBox} from './PromptBox.js';
import type {ParsedSession} from '../types.js';

type Phase = 'idle' | 'composed' | 'playing' | 'done';
type Mode = 'stream' | 'instant';

interface AppProps {
	session: ParsedSession;
}

export const App: React.FC<AppProps> = ({session}) => {
	const [turnIndex, setTurnIndex] = useState(-1);
	const [phase, setPhase] = useState<Phase>('idle');
	const [mode, setMode] = useState<Mode>('stream');
	const [skipCurrent, setSkipCurrent] = useState(false);
	const modeRef = useRef<Mode>(mode);
	const {exit} = useApp();

	useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	const startNextTurn = (): void => {
		const next = turnIndex + 1;
		if (next >= session.turns.length) {
			setPhase('done');
			return;
		}
		setSkipCurrent(false);
		setTurnIndex(next);
		setPhase('composed');
	};

	const submitComposed = (): void => {
		setPhase('playing');
	};

	const handleTurnComplete = (): void => {
		setPhase('idle');
		setSkipCurrent(false);
	};

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit();
			return;
		}
		if (input === 'q') {
			exit();
			return;
		}
		if (input === 'f') {
			setMode(m => (m === 'stream' ? 'instant' : 'stream'));
			return;
		}
		if (input === 'n' && phase === 'playing') {
			setSkipCurrent(true);
			return;
		}
		if (key.return) {
			if (phase === 'idle') startNextTurn();
			else if (phase === 'composed') submitComposed();
			else if (phase === 'done') exit();
		}
	});

	const turnElements: React.ReactElement[] = [];
	if (turnIndex >= 0) {
		const isTurnActive = phase === 'composed' || phase === 'playing';
		const lastCompleted = isTurnActive ? turnIndex - 1 : turnIndex;
		for (let i = 0; i <= lastCompleted; i++) {
			turnElements.push(
				<Turn
					key={i}
					turn={session.turns[i]!}
					mode="instant"
					onComplete={() => {}}
				/>,
			);
		}
		if (phase === 'playing') {
			turnElements.push(
				<Turn
					key={turnIndex}
					turn={session.turns[turnIndex]!}
					mode={mode}
					forceInstant={skipCurrent}
					onComplete={handleTurnComplete}
				/>,
			);
		}
	}

	const totalTurns = session.turns.length;
	const speedHint = `f ${mode === 'stream' ? '→ instant' : '→ stream'}`;
	const hint = ((): string => {
		switch (phase) {
			case 'idle':
				if (turnIndex < 0)
					return `↵ play turn 1/${totalTurns}   ${speedHint}   q quit`;
				if (turnIndex + 1 < totalTurns)
					return `↵ next turn (${turnIndex + 2}/${totalTurns})   ${speedHint}   q quit`;
				return `✓ end of session   ↵ quit   ${speedHint}`;
			case 'composed':
				return `↵ submit   ${speedHint}   q quit`;
			case 'playing':
				return `▸ playing turn ${turnIndex + 1}/${totalTurns}   ${speedHint}   n skip`;
			case 'done':
				return '✓ done   ↵ quit';
		}
	})();

	const promptText =
		phase === 'composed' ? session.turns[turnIndex]!.userPrompt : '';

	return (
		<Box flexDirection="column">
			{turnElements}
			<PromptBox text={promptText} cwd={session.cwd} hint={hint} />
		</Box>
	);
};
