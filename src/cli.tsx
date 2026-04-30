#!/usr/bin/env node
import React, {useState} from 'react';
import {render, Text} from 'ink';
import meow from 'meow';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {access, readdir} from 'node:fs/promises';
import {App} from './components/App.js';
import {Picker} from './components/Picker.js';
import {parseSession} from './parser.js';
import {findSessions, type SessionSummary} from './sessions.js';
import type {ParsedSession} from './types.js';

const cli = meow(
	`
	Usage
	  $ claude-replay [session]

	  session   Path to a session JSONL, or a session UUID. If omitted, picks from
	            ~/.claude/projects/

	Examples
	  $ claude-replay
	  $ claude-replay ~/.claude/projects/foo/abc.jsonl
	  $ claude-replay abc-123-uuid

	Keys (during replay)
	  Enter     Play next user turn
	  f         Toggle stream / instant playback speed
	  q         Quit
	`,
	{importMeta: import.meta},
);

async function resolveSessionPath(arg: string): Promise<string> {
	try {
		await access(arg);
		return arg;
	} catch {
		// Not a path — treat as UUID and search ~/.claude/projects
	}

	const projectsRoot = join(homedir(), '.claude', 'projects');
	const projects = await readdir(projectsRoot).catch(() => [] as string[]);
	for (const project of projects) {
		const candidate = join(projectsRoot, project, `${arg}.jsonl`);
		try {
			await access(candidate);
			return candidate;
		} catch {
			// keep searching
		}
	}
	throw new Error(
		`Could not resolve session "${arg}" — not a valid path and no matching UUID under ${projectsRoot}`,
	);
}

interface RootProps {
	initialSession: ParsedSession | null;
	sessions: SessionSummary[];
}

const Root: React.FC<RootProps> = ({initialSession, sessions}) => {
	const [session, setSession] = useState<ParsedSession | null>(initialSession);
	const [error, setError] = useState<string | null>(null);

	if (error) return <Text color="red">{error}</Text>;
	if (session) return <App session={session} />;

	return (
		<Picker
			sessions={sessions}
			onPick={picked => {
				parseSession(picked.path)
					.then(parsed => setSession(parsed))
					.catch((err: unknown) =>
						setError(err instanceof Error ? err.message : String(err)),
					);
			}}
		/>
	);
};

async function main(): Promise<void> {
	const arg = cli.input[0];
	if (arg) {
		const path = await resolveSessionPath(arg);
		const parsed = await parseSession(path);
		render(<Root initialSession={parsed} sessions={[]} />);
		return;
	}
	const sessions = await findSessions();
	render(<Root initialSession={null} sessions={sessions} />);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
