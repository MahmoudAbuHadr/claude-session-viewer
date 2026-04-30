import React, {useEffect, useRef, useState} from 'react';
import {Box, Text} from 'ink';
import {ToolPanel} from './ToolPanel.js';
import type {AssistantBlock, Turn as TurnT} from '../types.js';

type Mode = 'stream' | 'instant';

interface BlockState {
	block: AssistantBlock;
	charsRevealed: number;
	toolStatus: 'running' | 'done';
}

interface TurnProps {
	turn: TurnT;
	mode: Mode;
	forceInstant?: boolean;
	onComplete: () => void;
}

const TEXT_CHARS_PER_TICK = 3;
const TEXT_TICK_MS = 10;
const TOOL_RUNNING_MIN_MS = 150;
const TOOL_RUNNING_MAX_MS = 400;

const sleep = (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

const jitter = (base: number): number =>
	base + (Math.random() - 0.5) * base * 0.5;

export const Turn: React.FC<TurnProps> = ({
	turn,
	mode,
	forceInstant = false,
	onComplete,
}) => {
	const [blocks, setBlocks] = useState<BlockState[]>([]);
	const modeRef = useRef<Mode>(mode);
	const forceInstantRef = useRef<boolean>(forceInstant);

	useEffect(() => {
		modeRef.current = mode;
	}, [mode]);

	useEffect(() => {
		forceInstantRef.current = forceInstant;
	}, [forceInstant]);

	useEffect(() => {
		let cancelled = false;

		const isInstant = (): boolean =>
			modeRef.current === 'instant' || forceInstantRef.current;

		const streamText = async (
			text: string,
			set: (revealed: number) => void,
		): Promise<void> => {
			if (isInstant()) {
				set(text.length);
				return;
			}
			let revealed = 0;
			while (revealed < text.length) {
				if (cancelled) return;
				if (isInstant()) {
					set(text.length);
					return;
				}
				revealed = Math.min(text.length, revealed + TEXT_CHARS_PER_TICK);
				set(revealed);
				await sleep(jitter(TEXT_TICK_MS));
			}
		};

		const run = async (): Promise<void> => {
			for (let i = 0; i < turn.assistantBlocks.length; i++) {
				if (cancelled) return;
				const block = turn.assistantBlocks[i]!;

				setBlocks(prev => [
					...prev,
					{block, charsRevealed: 0, toolStatus: 'running'},
				]);

				if (block.type === 'text') {
					await streamText(block.text, revealed => {
						setBlocks(prev =>
							prev.map((b, idx) =>
								idx === i ? {...b, charsRevealed: revealed} : b,
							),
						);
					});
				} else if (block.type === 'tool_use') {
					if (!isInstant()) {
						const delay =
							TOOL_RUNNING_MIN_MS +
							Math.random() * (TOOL_RUNNING_MAX_MS - TOOL_RUNNING_MIN_MS);
						await sleep(delay);
					}
					if (cancelled) return;
					setBlocks(prev =>
						prev.map((b, idx) =>
							idx === i ? {...b, toolStatus: 'done'} : b,
						),
					);
				}
			}

			if (!cancelled) onComplete();
		};

		void run();
		return () => {
			cancelled = true;
		};
		// Intentionally only run once per Turn mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<Box flexDirection="column" marginY={0}>
			<Box>
				<Text color="gray">{'> '}</Text>
				<Text>{turn.userPrompt}</Text>
			</Box>
			{blocks.map((state, idx) => (
				<RenderedBlock key={idx} state={state} turn={turn} />
			))}
		</Box>
	);
};

interface RenderedBlockProps {
	state: BlockState;
	turn: TurnT;
}

const RenderedBlock: React.FC<RenderedBlockProps> = ({state, turn}) => {
	const {block, charsRevealed, toolStatus} = state;

	if (block.type === 'text') {
		return <Text>{block.text.slice(0, charsRevealed)}</Text>;
	}
	if (block.type === 'tool_use') {
		const result = turn.toolResults.get(block.id) ?? null;
		return <ToolPanel toolUse={block} result={result} status={toolStatus} />;
	}
	if (block.type === 'thinking') {
		return <Text color="gray">⏺ Thinking…</Text>;
	}
	return null;
};
