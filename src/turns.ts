import {parsePrompt} from './prompt.js';
import type {
	AssistantEvent,
	RawEvent,
	ToolResultBlock,
	Turn,
	UserEvent,
} from './types.js';

export class EmptySessionError extends Error {
	constructor(message = 'Session contains no real user prompts') {
		super(message);
		this.name = 'EmptySessionError';
	}
}

export function groupIntoTurns(events: RawEvent[]): Turn[] {
	const turns: Turn[] = [];
	let current: Turn | null = null;

	for (const event of events) {
		if (event.type === 'user') {
			const userEvent = event as UserEvent;
			const content = userEvent.message.content;

			if (typeof content === 'string') {
				current = {
					index: turns.length,
					prompt: parsePrompt(content),
					assistantBlocks: [],
					toolResults: new Map(),
				};
				turns.push(current);
				continue;
			}

			if (!current) continue;
			for (const block of content) {
				if (block.type === 'tool_result') {
					const toolResult = block as ToolResultBlock;
					current.toolResults.set(toolResult.tool_use_id, toolResult);
				}
			}
			continue;
		}

		if (event.type === 'assistant') {
			if (!current) continue;
			const assistantEvent = event as AssistantEvent;
			for (const block of assistantEvent.message.content) {
				current.assistantBlocks.push(block);
			}
		}
	}

	if (turns.length === 0) {
		throw new EmptySessionError();
	}

	return turns;
}
