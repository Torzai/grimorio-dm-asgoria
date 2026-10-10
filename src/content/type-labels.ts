import type { EntryType, FrontmatterOf } from './types';

export interface TypeLabel {
  /** One entry of the type, e.g. in an eyebrow: 'NPC · Puerto'. */
  singular: string;
  /** The category as a whole: sidebar, list titles. */
  plural: string;
}

export const TYPE_LABELS: Readonly<Record<EntryType, TypeLabel>> = {
  npc: { singular: 'NPC', plural: 'NPCs' },
  zona: { singular: 'Zona', plural: 'Zonas y mapas' },
  lore: { singular: 'Lore', plural: 'Lore y facciones' },
  varita: { singular: 'Varita', plural: 'Varitas' },
  comando: { singular: 'Comando', plural: 'Comandos' },
  herramienta: { singular: 'Herramienta', plural: 'Herramientas' },
  sesion: { singular: 'Sesión', plural: 'Diario de sesiones' },
};

/** Order of the types in the sidebar and anywhere types are listed. */
export const TYPE_NAV_ORDER: readonly EntryType[] = [
  'npc',
  'zona',
  'lore',
  'varita',
  'comando',
  'herramienta',
  'sesion',
];

export const LORE_CATEGORY_LABELS: Readonly<Record<FrontmatterOf<'lore'>['categoria'], string>> = {
  historia: 'Historia',
  faccion: 'Facción',
  religion: 'Religión',
  cultura: 'Cultura',
  otro: 'Otro',
};
