import {open, readdir, stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';

export interface SessionSummary {
	id: string;
	path: string;
	cwd: string;
	firstPrompt: string;
	mtime: Date;
}

export class NoSessionsFoundError extends Error {
	constructor() {
		super('No Claude Code sessions found in ~/.claude/projects');
		this.name = 'NoSessionsFoundError';
	}
}

const MAX_LINES_TO_SCAN = 50;
const FIRST_PROMPT_MAX_CHARS = 80;
const MAX_RESULTS = 50;

function truncate(value: string, max: number): string {
	return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

async function readFirstUserPrompt(
	path: string,
): Promise<{prompt: string; cwd: string} | null> {
	const fh = await open(path, 'r');
	try {
		let count = 0;
		let cwd = '';
		for await (const line of fh.readLines()) {
			count++;
			if (count > MAX_LINES_TO_SCAN) break;
			if (!line.trim()) continue;
			let parsed: unknown;
			try {
				parsed = JSON.parse(line);
			} catch {
				continue;
			}
			if (typeof parsed !== 'object' || parsed === null) continue;
			const obj = parsed as Record<string, unknown>;
			if (!cwd && typeof obj.cwd === 'string') cwd = obj.cwd;
			if (
				obj.type === 'user' &&
				typeof obj.message === 'object' &&
				obj.message !== null
			) {
				const msg = obj.message as Record<string, unknown>;
				if (typeof msg.content === 'string') {
					return {prompt: msg.content, cwd};
				}
			}
		}
		return null;
	} finally {
		await fh.close();
	}
}

export async function findSessions(): Promise<SessionSummary[]> {
	const root = join(homedir(), '.claude', 'projects');
	let projects: string[];
	try {
		projects = await readdir(root);
	} catch {
		throw new NoSessionsFoundError();
	}

	const summaries: SessionSummary[] = [];
	for (const project of projects) {
		const projectDir = join(root, project);
		let entries: string[];
		try {
			entries = await readdir(projectDir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.endsWith('.jsonl')) continue;
			const path = join(projectDir, entry);
			let stats;
			try {
				stats = await stat(path);
			} catch {
				continue;
			}
			if (!stats.isFile()) continue;
			const id = entry.replace(/\.jsonl$/, '');

			let firstPrompt = '';
			let cwd = '';
			try {
				const result = await readFirstUserPrompt(path);
				if (result) {
					firstPrompt = truncate(
						result.prompt.replace(/\s+/g, ' ').trim(),
						FIRST_PROMPT_MAX_CHARS,
					);
					cwd = result.cwd;
				}
			} catch {
				continue;
			}

			if (!firstPrompt) continue;
			summaries.push({id, path, cwd, firstPrompt, mtime: stats.mtime});
		}
	}

	summaries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

	if (summaries.length === 0) throw new NoSessionsFoundError();

	return summaries.slice(0, MAX_RESULTS);
}
