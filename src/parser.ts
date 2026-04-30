import {access, readFile} from 'node:fs/promises';
import {groupIntoTurns} from './turns.js';
import type {ParsedSession, RawEvent} from './types.js';

export class FileNotFoundError extends Error {
	constructor(filePath: string) {
		super(`Session file not found: ${filePath}`);
		this.name = 'FileNotFoundError';
	}
}

export class MalformedSessionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MalformedSessionError';
	}
}

const KEPT_TYPES = new Set(['user', 'assistant']);
const DROPPED_TYPES = new Set(['system', 'summary', 'attachment']);

export async function parseSession(filePath: string): Promise<ParsedSession> {
	try {
		await access(filePath);
	} catch {
		throw new FileNotFoundError(filePath);
	}

	const raw = await readFile(filePath, 'utf8');
	const lines = raw.split('\n').filter(line => line.trim().length > 0);

	const events: RawEvent[] = [];
	for (const [index, line] of lines.entries()) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (error) {
			throw new MalformedSessionError(
				`Failed to parse JSON on line ${index + 1}: ${(error as Error).message}`,
			);
		}

		if (typeof parsed !== 'object' || parsed === null) {
			throw new MalformedSessionError(
				`Line ${index + 1} is not a JSON object`,
			);
		}

		const event = parsed as Partial<RawEvent>;

		if (event.isSidechain === true) continue;
		if (typeof event.type !== 'string') continue;
		if (DROPPED_TYPES.has(event.type)) continue;
		if (!KEPT_TYPES.has(event.type)) continue;

		events.push(event as RawEvent);
	}

	if (events.length === 0) {
		throw new MalformedSessionError(
			'Session contains no user or assistant events',
		);
	}

	const hasUserEvent = events.some(event => event.type === 'user');
	if (!hasUserEvent) {
		throw new MalformedSessionError('Session contains no user events');
	}

	const first = events[0]!;
	const turns = groupIntoTurns(events);

	return {
		sessionId: first.sessionId,
		cwd: first.cwd,
		turns,
	};
}
