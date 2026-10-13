import type { EntryType, FrontmatterOf } from './types.ts';

export interface TypeLabel {
  /** One entry of the type, e.g. in an eyebrow: 'NPC · Puerto'. */
  singular: string;
  /** The category as a whole: sidebar, list titles. */
  plural: string;
}

export const TYPE_LABELS: Readonly<Record<EntryType, TypeLabel>> = {
  npc: { singular: 'NPC', plural: 'NPCs' },
  pj: { singular: 'PJ', plural: 'Personajes (PJ)' },
  zona: { singular: 'Zona', plural: 'Zonas y mapas' },
  lore: { singular: 'Lore', plural: 'Lore y facciones' },
  cronica: { singular: 'Situación', plural: 'Situación por regiones' },
  varita: { singular: 'Varita', plural: 'Varitas' },
  comando: { singular: 'Comando', plural: 'Comandos' },
  herramienta: { singular: 'Herramienta', plural: 'Herramientas' },
  sesion: { singular: 'Sesión', plural: 'Diario de sesiones' },
};

/** Order of the types in the sidebar and anywhere types are listed. */
export const TYPE_NAV_ORDER: readonly EntryType[] = [
  'npc',
  'pj',
  'zona',
  'lore',
  'cronica',
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
  cosmologia: 'Cosmología',
  otro: 'Otro',
};

export const PJ_ESTADO_LABELS: Readonly<Record<FrontmatterOf<'pj'>['estado'], string>> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  retirado: 'Retirado',
  muerto: 'Muerto',
};
