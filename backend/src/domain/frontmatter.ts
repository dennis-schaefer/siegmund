import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { MalformedFrontmatterError } from './errors.ts';

/**
 * The canonical frontmatter of a Vault Entry note.
 * Known fields are typed; any hand-added user fields land in `extras`.
 */
export type EntryFrontmatter = {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly created: string;
  readonly source: string;
  readonly area: string;
  readonly extras: Record<string, unknown>;
};

const KNOWN_FIELDS = [
  'id',
  'title',
  'type',
  'status',
  'created',
  'source',
  'area',
] as const satisfies ReadonlyArray<keyof Omit<EntryFrontmatter, 'extras'>>;

type KnownField = (typeof KNOWN_FIELDS)[number];

/** Fast membership test used in parseFrontmatter to separate known from extras. */
const KNOWN_FIELD_SET = new Set<string>(KNOWN_FIELDS);

/** Defaults for missing known fields per ADR-0006. */
const FIELD_DEFAULTS: Record<KnownField, string> = {
  id: '',
  title: '',
  type: '',
  status: 'open',
  created: '',
  source: '',
  area: 'inbox',
};

/**
 * Renders an `EntryFrontmatter` to a YAML fragment (no fences).
 * Emit order: id, title, type, status, created, source, area — then extras keys.
 */
export function buildFrontmatter(fm: EntryFrontmatter): string {
  const doc: Record<string, unknown> = {
    id: fm.id,
    title: fm.title,
    type: fm.type,
    status: fm.status,
    created: fm.created,
    source: fm.source,
    area: fm.area,
  };
  for (const [key, value] of Object.entries(fm.extras)) {
    doc[key] = value;
  }
  return stringifyYaml(doc);
}

/**
 * Parses a YAML fragment (no fences) into a typed `EntryFrontmatter`.
 *
 * - Known fields default when absent; missing `status` → `'open'`, missing `area` → `'inbox'`.
 * - Non-string scalar in a known field is coerced via `String(v)`.
 * - `type` and `status` are open vocabulary — unknown values are stored, never rejected.
 * - Unknown keys accumulate in `extras` by value; `extras` never holds a known key.
 * - Throws `MalformedFrontmatterError` for genuinely unparseable YAML.
 */
export function parseFrontmatter(yamlText: string): EntryFrontmatter {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    throw new MalformedFrontmatterError(err instanceof Error ? err.message : String(err));
  }

  const rawRecord = isPlainObject(raw) ? (raw as Record<string, unknown>) : {};

  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawRecord)) {
    if (!KNOWN_FIELD_SET.has(key)) {
      extras[key] = value;
    }
  }

  return {
    id: extractString(rawRecord, 'id'),
    title: extractString(rawRecord, 'title'),
    type: extractString(rawRecord, 'type'),
    status: extractString(rawRecord, 'status'),
    created: extractString(rawRecord, 'created'),
    source: extractString(rawRecord, 'source'),
    area: extractString(rawRecord, 'area'),
    extras,
  };
}

function extractString(record: Record<string, unknown>, field: KnownField): string {
  const value = record[field];
  if (value === null || value === undefined) {
    return FIELD_DEFAULTS[field];
  }
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
