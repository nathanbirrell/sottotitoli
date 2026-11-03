export interface Token {
  text: string;
  word: boolean;
}

// A run of letters, optionally followed by an apostrophe (elision: l', dell', po').
const WORD = /[\p{L}\p{M}]+['’]?/gu;

export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(WORD)) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), word: false });
    tokens.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), word: false });
  return tokens;
}
