import { pjHistoriales, pjSummaries } from 'virtual:grimorio/content';
import { whenIdle } from './idle.ts';
import { parseHistorial, type HistorialEntry } from './pj.ts';
import {
  historialItem,
  type HistorialItemMeta,
  type HistorialItemText,
  type PjSummary,
} from './pj-historial.ts';

const NO_ITEMS: readonly HistorialItemMeta[] = [];
/** Entries prepared per idle slice, so a long history doesn't block the page. */
const IDLE_SLICE = 10;

/** Totals of a PJ's history, computed at build time; undefined for an unknown slug. */
export function pjSummaryOf(slug: string): PjSummary | undefined {
  return pjSummaries[slug];
}

/** A PJ's history without the text of its entries, newest first; empty for an unknown slug. */
export function pjHistorialOf(slug: string): readonly HistorialItemMeta[] {
  return pjHistoriales[slug] ?? NO_ITEMS;
}

/** What a PJ's loaded body adds to its metadata. */
export interface PjBody {
  /** The body without the '## Historial' section, for the "Ficha y trasfondo" tab. */
  fichaBody: string;
  /** The text of a history entry, split on first use; undefined for an unknown id. */
  textOf: (id: string) => HistorialItemText | undefined;
  /** Splits every entry in idle slices, so a later search finds them ready. */
  prepareWhenIdle: () => () => void;
}

/**
 * Splits a PJ's body with the same functions as the build, so the ids match the metadata. The
 * section is cut at once (it's a pass over the lines); each entry is parsed when it's needed.
 */
export function splitPjBody(body: string, ownNames: readonly string[]): PjBody {
  const { entries, fichaBody } = parseHistorial(body);
  const byId = new Map<string, HistorialEntry>(entries.map((entry) => [entry.id, entry]));
  const texts = new Map<string, HistorialItemText>();

  const textOf = (id: string) => {
    let text = texts.get(id);
    const entry = byId.get(id);
    if (!text && entry) {
      const { bodyMarkdown, searchText } = historialItem(entry, ownNames);
      text = { bodyMarkdown, searchText };
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
