import React, {useEffect, useRef, useState} from 'react';
import {Box, useApp, useInput} from 'ink';
import {Turn} from './Turn.js';
import {PromptBox} from './PromptBox.js';
import type {ParsedSession} from '../types.js';

type Phase = 'idle' | 'typing' | 'playing' | 'done';
type Mode = 'stream' | 'instant';

interface AppProps {
	session: ParsedSession;
}

const PROMPT_CHAR_DELAY_MS = 6;

const sleep = (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

const jitter = (base: number): number =>
	base + (Math.random() - 0.5) * base * 0.5;

export const App: React.FC<AppProps> = ({session}) => {
	const [turnIndex, setTurnIndex] = useState(-1);
	const [phase, setPhase] = useState<Phase>('idle');
	const [mode, setMode] = useState<Mode>('stream');
	const [typedChars, setTypedChars] = useState(0);
	const [skipCurrent, setSkipCurrent] = useState(false);
	const modeRef = useRef<Mode>(mode);
	const {exit} = useApp();

	useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	useEffect(() => {
		if (phase !== 'typing') return;
		const cancelToken = {cancelled: false};
		void (async () => {
			const prompt = session.turns[turnIndex]!.userPrompt;
			const isInstant = (): boolean =>
				modeRef.current === 'instant' || skipCurrent;

			if (isInstant()) {
				setTypedChars(prompt.length);
			} else {
				for (let i = 1; i <= prompt.length; i++) {
					if (cancelToken.cancelled) return;
					if (isInstant()) {
						setTypedChars(prompt.length);
						break;
					}
					setTypedChars(i);
					await sleep(jitter(PROMPT_CHAR_DELAY_MS));
				}
			}

			if (cancelToken.cancelled) return;
			setPhase('playing');
		})();
		return () => {
			cancelToken.cancelled = true;
		};
	}, [phase, turnIndex, session.turns, skipCurrent]);

	const startNextTurn = (): void => {
		const next = turnIndex + 1;
		if (next >= session.turns.length) {
			setPhase('done');
			return;
		}
		setSkipCurrent(false);
		setTurnIndex(next);
		setTypedChars(0);
		setPhase('typing');
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
		if (
			input === 'n' &&
			(phase === 'typing' || phase === 'playing')
		) {
			setSkipCurrent(true);
			return;
		}
		if (key.return) {
			if (phase === 'idle') startNextTurn();
			else if (phase === 'done') exit();
		}
	});

	const turnElements: React.ReactElement[] = [];
	if (turnIndex >= 0) {
		const isTurnActive = phase === 'typing' || phase === 'playing';
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
			case 'typing':
				return `▸ typing turn ${turnIndex + 1}/${totalTurns}   ${speedHint}   n skip`;
			case 'playing':
				return `▸ playing turn ${turnIndex + 1}/${totalTurns}   ${speedHint}   n skip`;
			case 'done':
				return '✓ done   ↵ quit';
		}
	})();

	const promptText =
		phase === 'typing'
			? session.turns[turnIndex]!.userPrompt.slice(0, typedChars)
			: '';

	return (
		<Box flexDirection="column">
			{turnElements}
			<PromptBox text={promptText} cwd={session.cwd} hint={hint} />
		</Box>
	);
};
