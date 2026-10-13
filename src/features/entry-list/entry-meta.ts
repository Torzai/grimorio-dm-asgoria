import { cronicaMetaOf } from '@/content/cronica-data';
import { historialSummaryOf } from '@/content/historial-data';
import { LORE_CATEGORY_LABELS, PJ_ESTADO_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';

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

/** '2026-08-31' → '31/08/2026'. */
export function formatNumericDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Parts of the secondary line of a list card, skipping what the entry doesn't have:
 * zona title, then faction (NPC), category (lore), date (session) or last update (crónica).
 * A PJ shows its estado and the day of its latest history entry instead.
 */
export function getEntryMeta(entry: EntryMeta, zoneTitles: ReadonlyMap<string, string>): string[] {
  if (entry.data.type === 'pj') {
    const newest = historialSummaryOf(entry.slug)?.last;
    return [
      PJ_ESTADO_LABELS[entry.data.estado],
      newest ? `Última actividad ${formatNumericDate(newest)}` : 'Sin historial',
    ];
  }

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
    case 'cronica': {
      const updated = cronicaMetaOf(entry.slug)?.updated;
      if (updated) parts.push(`Última actualización ${formatNumericDate(updated)}`);
      break;
    }
  }
  return parts;
}
