import { historialItems, historialSummaries } from 'virtual:grimorio/content';
import { HISTORIAL_PROFILES, parseHistorial, type HistorialEntry, type HistorialType } from './historial.ts';
import {
  historialItem,
  type HistorialItemMeta,
  type HistorialItemText,
  type HistorialSummary,
} from './historial-items.ts';
import { whenIdle } from './idle.ts';

const NO_ITEMS: readonly HistorialItemMeta[] = [];
/** Entries prepared per idle slice, so a long history doesn't block the page. */
const IDLE_SLICE = 10;

/** Totals of an entry's history, computed at build time; undefined for an unknown slug. */
export function historialSummaryOf(slug: string): HistorialSummary | undefined {
  return historialSummaries[slug];
}

/** An entry's history without the text of its entries, in its order; empty for an unknown slug. */
export function historialItemsOf(slug: string): readonly HistorialItemMeta[] {
  return historialItems[slug] ?? NO_ITEMS;
}

/** What an entry's loaded body adds to the metadata of its history. */
export interface HistorialBody {
  /** The body without the '## Historial' section. */
  fichaBody: string;
  /** The text of a history entry, split on first use; undefined for an unknown id. */
  textOf: (id: string) => HistorialItemText | undefined;
  /** Splits every entry in idle slices, so a later search finds them ready. */
  prepareWhenIdle: () => () => void;
}

/**
 * Splits a body with the same functions as the build, so the ids match the metadata. The
 * section is cut at once (it's a pass over the lines); each entry is parsed when it's needed.
 */
export function splitHistorialBody(
  body: string,
  type: HistorialType,
  ownNames: readonly string[],
): HistorialBody {
  const { entries, fichaBody } = parseHistorial(body);
  const byId = new Map<string, HistorialEntry>(entries.map((entry) => [entry.id, entry]));
  const texts = new Map<string, HistorialItemText>();
  const options = { profile: HISTORIAL_PROFILES[type], ownNames };

  const textOf = (id: string) => {
    let text = texts.get(id);
    const entry = byId.get(id);
    if (!text && entry) {
      const { bodyMarkdown, searchText, blocks } = historialItem(entry, options);
      text = { bodyMarkdown, searchText, ...(blocks ? { blocks } : {}) };
      texts.set(id, text);
    }
    return text;
  };

  const prepareWhenIdle = () => {
    const pending = [...byId.keys()].filter((id) => !texts.has(id));
    let cancel = () => {};
    const next = () => {
      for (const id of pending.splice(0, IDLE_SLICE)) textOf(id);
      if (pending.length > 0) cancel = whenIdle(next);
    };
    cancel = whenIdle(next);
    return () => cancel();
  };

  return { fichaBody, textOf, prepareWhenIdle };
}
