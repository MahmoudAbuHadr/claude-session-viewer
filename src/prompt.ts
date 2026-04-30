export interface RenderedPrompt {
	display: string;
	isSlashCommand: boolean;
	stdout: string | null;
}

const COMMAND_NAME_RE = /<command-name>([\s\S]*?)<\/command-name>/;
const COMMAND_ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/;
const COMMAND_STDOUT_RE =
	/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/;
const ANY_TAG_BLOCK_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>[\s\S]*?<\/\1>/g;

export function parsePrompt(raw: string): RenderedPrompt {
	const nameMatch = raw.match(COMMAND_NAME_RE);
	if (nameMatch) {
		const name = nameMatch[1]!.trim().replace(/^\/+/, '');
		const argsMatch = raw.match(COMMAND_ARGS_RE);
		const args = argsMatch ? argsMatch[1]!.trim() : '';
		const display = args ? `/${name} ${args}` : `/${name}`;
		const stdoutMatch = raw.match(COMMAND_STDOUT_RE);
		const stdout = stdoutMatch ? stdoutMatch[1]!.replace(/\n+$/, '') : null;
		return {display, isSlashCommand: true, stdout};
	}

	const stripped = raw.replace(ANY_TAG_BLOCK_RE, '').trim();
	return {display: stripped, isSlashCommand: false, stdout: null};
}
