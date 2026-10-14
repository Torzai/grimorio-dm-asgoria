import { useEffect, useEffectEvent, type KeyboardEvent, type RefObject } from 'react';
import { useLocation } from 'react-router';
import type { Recipe } from '@/content/oficio';
import { openedFromTabBar } from './oficio-url';

/*
 * Keyboard and focus of the master-detail tabs. A list is a single tab stop (the open row, or the
 * first): arrows, Home and End move between its rows and Enter opens one, so Tab goes from the
 * list straight to the detail.
 */

const ROW_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/** onKeyDown of a list: moves the focus between its rows ([data-row]). */
export function handleRowKeys(event: KeyboardEvent<HTMLElement>) {
  if (!ROW_KEYS.has(event.key)) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-row]')];
  const current = rows.findIndex((row) => row === document.activeElement);
  if (current === -1) return;
  const last = rows.length - 1;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : event.key === 'ArrowDown'
          ? Math.min(current + 1, last)
          : Math.max(current - 1, 0);
  event.preventDefault();
  rows[next].focus();
}

function headerHeight(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
  return Number.parseFloat(value) || 0;
}

/**
 * When the selection changes (a row, a link, back and forward), the detail's heading gets the
 * focus and, when it is out of sight, the detail scrolls into view. A tab opened from the tab bar
 * (TAB_BAR_STATE) leaves the focus on the tabs.
 */
export function useDetailFocus(
  selected: string | undefined,
  headingRef: RefObject<HTMLElement | null>,
) {
  const { state } = useLocation();
  const fromTabBar = useEffectEvent(() => openedFromTabBar(state));
  useEffect(() => {
    const element = headingRef.current;
    if (selected === undefined || !element || fromTabBar()) return;
    element.focus({ preventScroll: true });
    const { top, bottom } = element.getBoundingClientRect();
    if (top < headerHeight() || bottom > window.innerHeight) {
      element.closest('article')?.scrollIntoView({ block: 'start' });
    }
  }, [selected, headingRef]);
}

/** Scrolls the list (when it scrolls on its own) to its open row ([aria-current]). */
export function useRevealRow(listRef: RefObject<HTMLElement | null>, selected: string | undefined) {
  useEffect(() => {
    const container = listRef.current;
    const row = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !row || container.scrollHeight <= container.clientHeight) return;
    const box = container.getBoundingClientRect();
    const { top, bottom } = row.getBoundingClientRect();
    // A third down, clear of the sticky group heading.
    if (top < box.top || bottom > box.bottom) container.scrollTop += top - box.top - box.height / 3;
  }, [listRef, selected]);
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** '×1 vez', '×3 veces'. */
export function timesText(veces: number): string {
  return `×${veces} ${veces === 1 ? 'vez' : 'veces'}`;
}

/** 'Nv 5 · DC 23', with what the recipe has of the two. */
export function levelAndDc(recipe: Pick<Recipe, 'nivel' | 'dc'>): string {
  return [
    recipe.nivel === undefined ? undefined : `Nv ${recipe.nivel}`,
    recipe.dc === undefined ? undefined : `DC ${recipe.dc}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
