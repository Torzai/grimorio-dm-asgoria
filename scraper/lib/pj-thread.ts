import { normalize } from '../../src/content/normalize';
import { NOTICE_TITLE_PATTERN, STAFF_GROUPS, THREAD_TITLE_PATTERN } from '../config';
import { isAuthorizationForm } from './pj-sheet';
import type { ForumPost } from './thread-page';

/** Where a thread of _index.json ends: every thread lands in exactly one group. */
export type PjThreadGroup = 'formulario' | 'ficha-libre' | 'excluido' | 'fallido';

export interface PjThreadVerdict {
  group: Exclude<PjThreadGroup, 'fallido'>;
  /** Why a thread is excluded. */
  reason?: string;
}

export interface PjThreadOutcome {
  thread: string;
  group: PjThreadGroup;
  /** Reason of an exclusion or error of a failure. */
  reason?: string;
}

const GROUP_LABELS: Record<PjThreadGroup, string> = {
  formulario: 'Con formulario',
  'ficha-libre': 'Ficha libre',
  excluido: 'Excluidos',
  fallido: 'Fallidos',
};

/**
 * A thread is a PJ unless it is clearly something else: its title does not follow
 * "Nombre ( Cuenta )" and either its post #1 is by staff or its title announces rules,
 * templates or a notice. A PJ whose post #1 has no form that can be read is a 'ficha-libre'.
 * The staff check needs posts.json extracted with `authorGroups` (scrape:pjs does it).
 */
export function classifyPjThread(title: string, opening: ForumPost): PjThreadVerdict {
  if (isAuthorizationForm(opening.html)) return { group: 'formulario' };
  if (followsPjTitle(title)) return { group: 'ficha-libre' };

  const staff = (opening.authorGroups ?? []).filter((group) => STAFF_GROUPS.includes(group));
  if (staff.length > 0) {
    return {
      group: 'excluido',
      reason: `post #1 de staff (${staff.join(', ')}) y el título no sigue «Nombre ( Cuenta )»`,
    };
  }
  const notice = NOTICE_TITLE_PATTERN.exec(normalize(title))?.[0];
  if (notice) {
    return {
      group: 'excluido',
      reason: `título de normas o aviso («${notice}») que no sigue «Nombre ( Cuenta )»`,
    };
  }
  return { group: 'ficha-libre' };
}

/** "Elae ( Idril )": a name and an account in brackets, both written. */
export function followsPjTitle(title: string): boolean {
  const match = THREAD_TITLE_PATTERN.exec(title);
  return match !== null && match[1].trim() !== '' && match[2].trim() !== '';
}

/**
 * Totals of every group, the reasons of the exclusions and the errors of the failures. Both
 * scrape:pjs and scrape:convert-all end with it, and their sum is checked against the index.
 */
export function pjThreadSummary(outcomes: readonly PjThreadOutcome[], listed: number): string[] {
  const of = (group: PjThreadGroup) => outcomes.filter((outcome) => outcome.group === group);
  const total = outcomes.length;
  const lines = [
    'Resumen de hilos de PJ',
    ...(['formulario', 'ficha-libre', 'excluido', 'fallido'] as const).map(
      (group) => `  ${`${GROUP_LABELS[group]}:`.padEnd(16)} ${of(group).length}`,
    ),
    `  ${'Total:'.padEnd(16)} ${total} de ${listed} hilos en _index.json ` +
      (total === listed ? '✔' : '⚠ no coinciden (¿--only, --limit o hilos fuera del índice?)'),
  ];
  for (const group of ['excluido', 'fallido'] as const) {
    const items = of(group);
    if (items.length === 0) continue;
    lines.push(`  ${GROUP_LABELS[group]}:`);
    for (const { thread, reason } of items) lines.push(`    ${thread}: ${reason ?? '?'}`);
  }
  return lines;
}

/** Message of anything thrown, for a report line. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
