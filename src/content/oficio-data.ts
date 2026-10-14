import { oficios } from 'virtual:grimorio/content';
import type { OficioMeta } from './oficio.ts';

/** What the build derived from an oficio; undefined for an unknown slug. */
export function oficioMetaOf(slug: string): OficioMeta | undefined {
  return oficios[slug];
}
