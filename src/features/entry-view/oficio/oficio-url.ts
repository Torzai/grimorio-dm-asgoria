import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { useLocation, useSearchParams, type To } from 'react-router';
import { isOficioTab, type OficioTab } from '@/content/oficio';

/*
 * The state of an oficio's view lives in its URL, so every selection can be linked, bookmarked
 * and undone with the back button:
 *   tab                             recetas | componentes | fabricar | habilidades
 *   r, q, grupo, nivel              Recetas: the open recipe, the search and the chips
 *   c, cq, origen, familia          Componentes: the open component, the search and the chips
 *   h                               Habilidades: the skill a link points to
 * Each tab keeps its own parameters, so going back to a tab finds it as it was left.
 */

export type OficioParam =
  'tab' | 'r' | 'q' | 'grupo' | 'nivel' | 'c' | 'cq' | 'origen' | 'familia' | 'h';

export type ParamChanges = Partial<Record<OficioParam, string | undefined>>;

/** The query with some parameters set, or removed when undefined or empty: '?tab=recetas&r=x'. */
export function withParams(search: string | URLSearchParams, changes: ParamChanges): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** The open tab: ?tab=, or Recetas when it is missing or unknown. */
export function tabOf(params: URLSearchParams): OficioTab {
  const tab = params.get('tab');
  return isOficioTab(tab) ? tab : 'recetas';
}

/** Changes parameters in place (no new history entry), as filters and tabs do. */
export function useSetParams(): (changes: ParamChanges, state?: unknown) => void {
  const [, setParams] = useSearchParams();
  return useCallback(
    (changes: ParamChanges, state?: unknown) =>
      setParams((previous) => new URLSearchParams(withParams(previous, changes)), {
        replace: true,
        state,
      }),
    [setParams],
  );
}

/**
 * The history state of a tab opened from the tab bar: what that tab has open doesn't take the
 * focus from the tabs. Any other navigation (a row, a link) has no state.
 */
export const TAB_BAR_STATE = { oficioTabBar: true };

export function openedFromTabBar(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'oficioTabBar' in state;
}

/** Builds links inside the oficio: the same page with some parameters changed. */
export function useParamLink(): (changes: ParamChanges) => To {
  const { pathname, search } = useLocation();
  return useCallback(
    (changes: ParamChanges) => ({ pathname, search: withParams(search, changes) }),
    [pathname, search],
  );
}

/** Where a recipe, a component or a skill opens: its tab, with it selected. */
export const recipeParams = (id: string): ParamChanges => ({ tab: 'recetas', r: id });
export const componentParams = (key: string): ParamChanges => ({ tab: 'componentes', c: key });
export const skillParams = (numero: number): ParamChanges => ({
  tab: 'habilidades',
  h: String(numero),
});

const DEBOUNCE_MS = 150;

/**
 * The text of a search box, kept in a parameter of the URL 150 ms after the DM stops typing.
 * When the URL changes from outside (back button, a link), it wins over the box.
 */
export function useQueryParam(key: OficioParam): [string, (value: string) => void] {
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const urlValue = params.get(key) ?? '';
  const [value, setValue] = useState(urlValue);
  const [synced, setSynced] = useState(urlValue);
  if (urlValue !== synced) {
    setSynced(urlValue);
    setValue(urlValue);
  }
  const commit = useEffectEvent((next: string) => {
    setSynced(next.trim());
    setParams({ [key]: next.trim() });
  });
  useEffect(() => {
    if (value.trim() === urlValue) return;
    const timer = setTimeout(() => commit(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, urlValue]);
  return [value, setValue];
}
