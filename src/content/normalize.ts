const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase, trimmed and without accents or diacritics: 'Sigründ ' → 'sigrund'. */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

/** Apostrophes and accents written in their place: Drak'Nar, Drak’Nar, Drak`Nar, Drak´Nar. */
const APOSTROPHES = /['’‘`´]/g;

/**
 * Without apostrophes, so 'Drak'Nar', 'Drak`nar' and 'Draknar' read the same in searches.
 * Slugs keep using normalize(): changing them would break existing links.
 */
export function withoutApostrophes(value: string): string {
  return value.replace(APOSTROPHES, '');
}

/** ASCII kebab-case: 'Tobías, el Mercader' → 'tobias-el-mercader'. */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
