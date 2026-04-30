export interface MarkdownDoc {
	blocks: MdBlock[];
	tableRanges: TableRange[];
}

export type MdBlock =
	| MdHeading
	| MdParagraph
	| MdList
	| MdCode
	| MdBlockquote
	| MdHr
	| MdTable;

export interface MdHeading {
	type: 'heading';
	depth: 1 | 2 | 3 | 4 | 5 | 6;
	inlines: MdInline[];
}

export interface MdParagraph {
	type: 'paragraph';
	inlines: MdInline[];
}

export interface MdList {
	type: 'list';
	ordered: boolean;
	start: number;
	items: MdListItem[];
}

export interface MdListItem {
	blocks: MdBlock[];
	task: boolean;
	checked: boolean;
}

export interface MdCode {
	type: 'code';
	lang: string | null;
	text: string;
}

export interface MdBlockquote {
	type: 'blockquote';
	blocks: MdBlock[];
}

export interface MdHr {
	type: 'hr';
}

export interface MdTable {
	type: 'table';
	align: Array<'left' | 'right' | 'center' | null>;
	header: MdInline[][];
	rows: MdInline[][][];
}

export type MdInline =
	| {type: 'text'; text: string}
	| {type: 'strong'; children: MdInline[]}
	| {type: 'em'; children: MdInline[]}
	| {type: 'codespan'; text: string}
	| {type: 'link'; href: string; children: MdInline[]}
	| {type: 'del'; children: MdInline[]}
	| {type: 'br'};

export interface TableRange {
	start: number;
	end: number;
	block: MdTable;
}
