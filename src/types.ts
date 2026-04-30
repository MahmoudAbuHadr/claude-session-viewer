export type {RenderedPrompt} from './prompt.js';
import type {RenderedPrompt} from './prompt.js';

export interface BaseEvent {
	uuid: string;
	parentUuid: string | null;
	isSidechain: boolean;
	timestamp: string;
	sessionId: string;
	cwd: string;
	type: string;
}

export interface TextBlock {
	type: 'text';
	text: string;
}

export interface ToolUseBlock {
	type: 'tool_use';
	id: string;
	name: string;
	input: Record<string, unknown>;
}

export interface ThinkingBlock {
	type: 'thinking';
	thinking: string;
}

export type ToolResultContent =
	| string
	| Array<{type: string; text?: string}>;

export interface ToolResultBlock {
	type: 'tool_result';
	tool_use_id: string;
	content: ToolResultContent;
	is_error?: boolean;
}

export type AssistantBlock = TextBlock | ToolUseBlock | ThinkingBlock;

export interface UserStringMessage {
	role: 'user';
	content: string;
}

export interface UserArrayMessage {
	role: 'user';
	content: Array<ToolResultBlock | TextBlock>;
}

export type UserMessage = UserStringMessage | UserArrayMessage;

export interface UserEvent extends BaseEvent {
	type: 'user';
	message: UserMessage;
}

export interface AssistantMessage {
	role: 'assistant';
	content: AssistantBlock[];
}

export interface AssistantEvent extends BaseEvent {
	type: 'assistant';
	message: AssistantMessage;
}

export interface OtherEvent extends BaseEvent {
	type: 'system' | 'summary' | 'attachment';
}

export type RawEvent = UserEvent | AssistantEvent | OtherEvent;

export interface Turn {
	index: number;
	prompt: RenderedPrompt;
	assistantBlocks: AssistantBlock[];
	toolResults: Map<string, ToolResultBlock>;
}

export interface ParsedSession {
	sessionId: string;
	cwd: string;
	turns: Turn[];
}
