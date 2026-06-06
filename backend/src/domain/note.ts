import { buildFrontmatter, parseFrontmatter } from './frontmatter.ts';
import type { EntryFrontmatter } from './frontmatter.ts';

/**
 * A Vault Entry in its in-memory representation.
 * `body` is plain cleaned text — no H1 (the title lives in frontmatter).
 */
export type Entry = {
  readonly frontmatter: EntryFrontmatter;
  readonly body: string;
};

/**
 * Renders an `Entry` to a full Markdown note string.
 * Format: opening `---` fence + YAML frontmatter + closing `---` fence + blank line + body.
 */
export function buildNote(entry: Entry): string {
  const fm = buildFrontmatter(entry.frontmatter);
  return `---\n${fm}---\n\n${entry.body}`;
}

/**
 * Parses a Markdown note string into an `Entry`.
 *
 * Tolerance rules (per ADR-0005/0006 — never destroy content):
 * - No leading `---` fence → all-default frontmatter, whole text as body.
 * - Opening fence present but closing fence absent → whole text as body, defaults.
 * - Body text containing `---` is preserved unchanged.
 *
 * Throws `MalformedFrontmatterError` when the YAML between fences is unparseable,
 * so the Module-4 writer can quarantine the file instead of overwriting it.
 */
export function parseNote(text: string): Entry {
  if (!text.startsWith('---\n')) {
    return { frontmatter: defaultFrontmatter(), body: text };
  }

  const rest = text.slice(4); // skip opening '---\n'
  const closingMatch = /^---$/m.exec(rest);

  if (closingMatch === null) {
    // Tolerant: missing closing fence means the text is unrecognised — keep it intact.
    return { frontmatter: defaultFrontmatter(), body: text };
  }

  const yamlText = rest.slice(0, closingMatch.index);

  // Skip the newline ending the closing '---' line, then the blank-line separator
  // that buildNote inserts between the closing fence and the body.
  let body = rest.slice(closingMatch.index + 3); // consume '---'
  if (body.startsWith('\n')) body = body.slice(1); // newline ending '---\n'
  if (body.startsWith('\n')) body = body.slice(1); // blank-line separator

  return { frontmatter: parseFrontmatter(yamlText), body };
}

function defaultFrontmatter(): EntryFrontmatter {
  return parseFrontmatter('');
}
