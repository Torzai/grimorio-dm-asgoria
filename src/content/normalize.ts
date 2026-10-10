const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase, trimmed and without accents or diacritics: 'Sigründ ' → 'sigrund'. */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

/** ASCII kebab-case: 'Tobías, el Mercader' → 'tobias-el-mercader'. */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
