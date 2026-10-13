import type { HistorialType } from '@/content/historial';

/** The words of a history's view, per type: a PJ's quests or a crónica's annexes. */
export interface HistorialUi {
  /** 'entrada' / 'entradas' */
  one: string;
  many: string;
  searchLabel: string;
  searchPlaceholder: string;
  /** URL parameter of the author filter. */
  authorParam: 'dm' | 'autor';
  authorLabel: string;
  authorAll: string;
  authorPrefix: string;
  empty: string;
  noMatches: string;
  copyLink: string;
}

export const HISTORIAL_UI: Readonly<Record<HistorialType, HistorialUi>> = {
  pj: {
    one: 'entrada',
    many: 'entradas',
    searchLabel: 'Buscar en el historial',
    searchPlaceholder: 'Buscar en el historial…',
    authorParam: 'dm',
    authorLabel: 'Filtrar por DM',
    authorAll: 'DM: todos',
    authorPrefix: 'DM',
    empty: 'Este PJ todavía no tiene historial.',
    noMatches: 'Ninguna entrada coincide con la búsqueda y los filtros.',
    copyLink: 'Enlace a esta entrada',
  },
  cronica: {
    one: 'anexo',
    many: 'anexos',
    searchLabel: 'Buscar en los anexos',
    searchPlaceholder: 'Buscar en los anexos…',
    authorParam: 'autor',
    authorLabel: 'Filtrar por autor',
    authorAll: 'Autor: todos',
    authorPrefix: 'Autor',
    empty: 'Esta crónica todavía no tiene anexos.',
    noMatches: 'Ningún anexo coincide con la búsqueda y el filtro.',
    copyLink: 'Enlace a este anexo',
  },
};

/** '1 entrada', '6 anexos'. */
export function countText(ui: HistorialUi, count: number): string {
  return `${count} ${count === 1 ? ui.one : ui.many}`;
}
