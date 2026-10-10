import { LORE_CATEGORY_LABELS } from '@/content/type-labels';
import type { Entry } from '@/content/types';

const dateFormat = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  // ISO dates are plain days; without this the local zone could show the day before.
  timeZone: 'UTC',
});

/** '2026-01-10' → '10 ene 2026'. */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(isoDate));
}

/**
 * Parts of the secondary line of a list card, skipping what the entry doesn't have:
 * zona title, then faction (NPC), category (lore) or date (session).
 */
export function getEntryMeta(entry: Entry, zoneTitles: ReadonlyMap<string, string>): string[] {
  const parts: string[] = [];
  const { zona } = entry.data;
  if (zona) parts.push(zoneTitles.get(zona) ?? zona);
  switch (entry.data.type) {
    case 'npc':
      if (entry.data.faccion) parts.push(entry.data.faccion);
      break;
    case 'lore':
      parts.push(LORE_CATEGORY_LABELS[entry.data.categoria]);
      break;
    case 'sesion':
      parts.push(formatDate(entry.data.fecha));
      break;
  }
  return parts;
}
