import { splitFrontmatter } from './frontmatter';
import { slugify } from './normalize';
import { SLUG_PATTERN, entryFrontmatterSchema, entrySchemas } from './schemas';
import { ENTRY_TYPES, type ContentIssue, type Entry, type EntryType } from './types';

export interface LoadResult {
  entries: Entry[];
  issues: ContentIssue[];
}

interface Source {
  path: string;
  slug: string;
  raw: string;
}

/**
 * Turns raw Markdown files into validated entries.
 * Keys may be Vite-style ('/content/npc/x.md') or repo-relative ('content/npc/x.md').
 * Entries with at least one error are left out; their issues are still returned.
 */
export function loadEntries(files: Record<string, string>): LoadResult {
  const sources: Source[] = Object.entries(files)
    .map(([key, raw]) => {
      const path = normalizePath(key);
      return { path, slug: slugFromPath(path), raw };
    })
    .filter(({ path }) => isEntryPath(path))
    .sort((a, b) => compare(a.path, b.path));

  const pathsBySlug = new Map<string, string[]>();
  for (const { path, slug } of sources) {
    pathsBySlug.set(slug, [...(pathsBySlug.get(slug) ?? []), path]);
  }

  const entries: Entry[] = [];
  const issues: ContentIssue[] = [];
  for (const source of sources) {
    const duplicates = (pathsBySlug.get(source.slug) ?? []).filter((p) => p !== source.path);
    const result = parseEntry(source, duplicates);
    issues.push(...result.issues);
    if (result.entry) entries.push(result.entry);
  }

  return { entries, issues };
}

function parseEntry(
  { path, slug, raw }: Source,
  duplicates: string[],
): { entry?: Entry; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const error = (message: string, field?: string) =>
    issues.push({ path, level: 'error', field, message });

  if (!SLUG_PATTERN.test(slug)) {
    error(
      `el nombre del fichero '${slug}.md' no es válido: usa solo minúsculas sin tildes, números y guiones, p. ej. '${slugify(slug) || 'mi-ficha'}.md'`,
    );
  }
  if (duplicates.length > 0) {
    error(
      `el nombre de fichero '${slug}' ya lo usa otra ficha (${duplicates.join(', ')}); cada ficha necesita un nombre de fichero único en todo content/`,
    );
  }

  const split = splitFrontmatter(raw);
  if (!split.ok) {
    error(split.error);
    return { issues };
  }
  if (!isRecord(split.frontmatter)) {
    error("la cabecera debe ser una lista de campos con el formato 'campo: valor'");
    return { issues };
  }

  // Empty fields ('zona:' with nothing after it) count as not written.
  const fields = withoutEmptyValues(split.frontmatter);

  const parsed = entryFrontmatterSchema.safeParse(fields);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [field] = issue.path;
      error(issue.message, field === undefined ? undefined : String(field));
    }
  }

  if (isEntryType(fields.type)) {
    const folder = folderOf(path);
    if (folder !== fields.type) {
      error(folderMessage(folder, fields.type), 'type');
    }
    for (const key of unknownKeys(fields, fields.type)) {
      issues.push({ path, level: 'warning', field: key, message: unknownKeyMessage(key, fields.type) });
    }
  }

  if (!parsed.success || issues.some((issue) => issue.level === 'error')) {
    return { issues };
  }

  return {
    entry: { slug, type: parsed.data.type, path, data: parsed.data, body: split.body },
    issues,
  };
}

function normalizePath(key: string): string {
  return key.replaceAll('\\', '/').replace(/^\.?\//, '');
}

function slugFromPath(path: string): string {
  return (path.split('/').at(-1) ?? '').replace(/\.md$/i, '');
}

/** Skips anything under a '_' segment (_templates, _inbox), assets/ and content/README.md. */
function isEntryPath(path: string): boolean {
  const segments = path.split('/');
  if (segments[0] !== 'content' || segments.length < 2) return false;
  if (!path.toLowerCase().endsWith('.md')) return false;
  if (segments.some((segment) => segment.startsWith('_'))) return false;
  if (segments[1] === 'assets') return false;
  return !(segments.length === 2 && segments[1].toLowerCase() === 'readme.md');
}

function folderOf(path: string): string | undefined {
  const segments = path.split('/');
  return segments.length > 2 ? segments[1] : undefined;
}

function folderMessage(folder: string | undefined, type: EntryType): string {
  return folder === undefined
    ? `la ficha debe estar dentro de la carpeta de su tipo: muévela a content/${type}/`
    : `la ficha está en la carpeta '${folder}' pero su 'type' es '${type}': muévela a content/${type}/ o corrige el campo 'type'`;
}

function unknownKeys(fields: Record<string, unknown>, type: EntryType): string[] {
  const known = entrySchemas[type].shape;
  return Object.keys(fields).filter((key) => !(key in known));
}

function unknownKeyMessage(key: string, type: EntryType): string {
  const suggestion = closest(key, Object.keys(entrySchemas[type].shape));
  const hint = suggestion ? ` (¿quisiste decir '${suggestion}'?)` : '';
  return `campo desconocido '${key}'${hint}; se ignora`;
}

/** Closest candidate within 2 edits, or undefined. */
function closest(word: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  for (const candidate of candidates) {
    const distance = editDistance(word, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function withoutEmptyValues(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value != null));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEntryType(value: unknown): value is EntryType {
  return typeof value === 'string' && (ENTRY_TYPES as readonly string[]).includes(value);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
