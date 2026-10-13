import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { queryTerms } from '@/content/highlight';
import { recentActivePjs } from '@/content/pj-data';
import { useSearchIndex } from '@/content/search-data';
import { search, type SearchResult } from '@/content/search-index';
import { useContent } from '@/content/use-content';
import { itemOfResult, resultOfItem, type ResolvedItem } from '@/features/pins/saved-items';
import { usePins, useRecents } from '@/features/pins/use-saved-items';
import { PaletteContext, usePalette, type PaletteControls } from './palette-context';
import { PalettePreview } from './PalettePreview';
import {
  KIND_LABELS,
  groupResults,
  kindsWithResults,
  resultTarget,
  searchPageTarget,
  type ResultGroup,
  type ResultKind,
  type ResultOption,
} from './palette-results';
import { ResultGroups } from './ResultGroups';
import styles from './CommandPalette.module.css';

const DEBOUNCE_MS = 80;
const MAX_PER_GROUP = 6;
const SUGGESTIONS = 8;
const NOTICE_MS = 1500;

type KindFilter = ResultKind | 'all';

interface PaletteProviderProps {
  children: ReactNode;
}

/**
 * Owns the palette: its open state, its query and its shortcuts. Ctrl+K / Cmd+K opens it from
 * anywhere, '/' when the focus is not in a text field; PaletteTrigger opens it on click. The
 * query is kept here, so it is still there when the palette opens again.
 */
export function PaletteProvider({ children }: PaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const openerRef = useRef<HTMLElement | null>(null);
  // Set while the focus goes back to the opener, which would open the palette again.
  const restoringFocus = useRef(false);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        if (!open) {
          openerRef.current = asOpener(document.activeElement);
          setOpen(true);
        }
      } else if (
        event.key === '/' &&
        !open &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTextField(event.target)
      ) {
        event.preventDefault();
        openerRef.current = asOpener(document.activeElement);
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const controls = useMemo<PaletteControls>(
    () => ({
      isOpen: open,
      query,
      openFrom(opener) {
        openerRef.current = opener;
        setOpen(true);
      },
      isRestoringFocus: () => restoringFocus.current,
    }),
    [open, query],
  );

  function close(restoreFocus: boolean) {
    setOpen(false);
    const opener = openerRef.current;
    openerRef.current = null;
    if (!restoreFocus || !opener?.isConnected) return;
    restoringFocus.current = true;
    opener.focus({ preventScroll: true });
    restoringFocus.current = false;
  }

  return (
    <PaletteContext value={controls}>
      {children}
      {open &&
        createPortal(
          <PaletteDialog query={query} onQueryChange={setQuery} onClose={close} />,
          document.body,
        )}
    </PaletteContext>
  );
}

/**
 * A search box that opens the palette: the header's, and the large one of the home
 * ('large').
 */
export function PaletteTrigger({ large = false }: { large?: boolean }) {
  const { isOpen, query, openFrom, isRestoringFocus } = usePalette();

  function handleFocus(event: FocusEvent<HTMLButtonElement>) {
    // Coming back to the window refocuses the trigger with no related target: not a request.
    if (isOpen || isRestoringFocus() || event.relatedTarget === null) return;
    openFrom(event.currentTarget);
  }

  return (
    <button
      type="button"
      className={large ? `${styles.trigger} ${styles.triggerLarge}` : styles.trigger}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K /"
      onFocus={handleFocus}
      onClick={(event) => {
        if (!isOpen) openFrom(event.currentTarget);
      }}
    >
      <svg
        className={styles.triggerIcon}
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <span className={query ? styles.triggerQuery : styles.triggerPlaceholder}>
        {query || 'Busca un NPC, comando, varita, zona…'}
      </span>
      <kbd className={styles.shortcut} aria-hidden="true">
        Ctrl K
      </kbd>
    </button>
  );
}

function asOpener(element: Element | null): HTMLElement | null {
  return element instanceof HTMLElement && element !== document.body ? element : null;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(
    target.type,
  );
}

interface PaletteDialogProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** restoreFocus: false when the palette closes because it opened something. */
  onClose: (restoreFocus: boolean) => void;
}

function PaletteDialog({ query, onQueryChange, onClose }: PaletteDialogProps) {
  const navigate = useNavigate();
  const { entries } = useContent();
  const index = useSearchIndex();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (key: string) => `${baseId}-option-${key}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The query the results are for, 80 ms behind the input.
  const [searched, setSearched] = useState(query);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string>();

  useEffect(() => {
    if (query === searched) return;
    const timer = setTimeout(() => setSearched(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searched]);

  useEffect(() => {
    // A query kept from last time comes selected, so typing replaces it.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const hasQuery = searched.trim() !== '';
  const results = useMemo(
    () => (index && hasQuery ? search(index, searched, { limit: Infinity }) : undefined),
    [index, hasQuery, searched],
  );
  const { pins, toggle } = usePins();
  const { recents } = useRecents();
  const suggestions = useMemo(
    () =>
      recentActivePjs(entries, SUGGESTIONS).map(({ entry }): SearchResult => ({
        slug: entry.slug,
        type: entry.type,
        title: entry.data.title,
        score: 0,
      })),
    [entries],
  );
  const kinds = useMemo(() => (results ? kindsWithResults(results) : []), [results]);
  // A filter whose kind has no results for this query is not shown, nor applied.
  const activeKind: KindFilter =
    kindFilter !== 'all' && kinds.includes(kindFilter) ? kindFilter : 'all';
  const chips: KindFilter[] = hasQuery && kinds.length > 0 ? ['all', ...kinds] : [];

  const groups: ResultGroup[] = useMemo(() => {
    if (!hasQuery) {
      return [
        savedGroup('pins', 'Fijados', pins),
        savedGroup('recents', 'Recientes', recents),
        ...groupResults(suggestions).map((group) => ({
          ...group,
          key: 'active',
          label: 'PJ activos',
          options: group.options.map((option) => ({ ...option, key: `active:${option.key}` })),
        })),
      ].filter((group) => group.options.length > 0);
    }
    if (!results) return [];
    return groupResults(results, {
      kind: activeKind === 'all' ? undefined : activeKind,
      maxPerGroup: MAX_PER_GROUP,
    });
  }, [hasQuery, pins, recents, suggestions, results, activeKind]);

  const options = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];
  const terms = useMemo(() => queryTerms(searched), [searched]);

  const selectedId = selected ? optionId(selected.key) : undefined;
  useEffect(() => {
    if (selectedId) document.getElementById(selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  function pick(option: ResultOption) {
    onClose(false);
    navigate(
      'result' in option
        ? resultTarget(option.result, searched)
        : searchPageTarget(searched, option.kind),
    );
  }

  // "Fijado" / "Quitado" after Ctrl+Enter, for a moment.
  const [notice, setNotice] = useState<{ text: string; id: number }>();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  function togglePin(option: ResultOption) {
    if (!('result' in option)) return;
    const item = itemOfResult(option.result);
    const pinned = toggle(item);
    setNotice((previous) => ({
      text: pinned ? 'Fijado' : 'Quitado',
      id: (previous?.id ?? 0) + 1,
    }));
    // Unpinned from the "Fijados" group, the row leaves: select the one that takes its place.
    if (!pinned && option.key.startsWith('pins:')) {
      const at = options.indexOf(option);
      const rest = options.filter((other) => other !== option);
      setSelectedKey(rest[Math.min(at, rest.length - 1)]?.key);
    }
  }

  function moveSelection(to: number) {
    if (options.length === 0) return;
    const wrapped = (to + options.length) % options.length;
    setSelectedKey(options[wrapped].key);
  }

  function cycleKind(step: number) {
    if (chips.length === 0) return;
    const current = chips.indexOf(activeKind);
    setKindFilter(chips[(current + step + chips.length) % chips.length]);
    setSelectedKey(undefined);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const current = selected ? options.indexOf(selected) : -1;
    switch (event.key) {
      case 'ArrowDown':
        moveSelection(current + 1);
        break;
      case 'ArrowUp':
        moveSelection(current - 1);
        break;
      case 'Home':
        moveSelection(0);
        break;
      case 'End':
        moveSelection(options.length - 1);
        break;
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          if (selected) togglePin(selected);
        } else if (selected) pick(selected);
        else if (hasQuery) {
          onClose(false);
          navigate(searchPageTarget(searched));
        }
        break;
      case 'Tab':
        // Tab and Shift+Tab go through the type chips; the focus stays in the input.
        cycleKind(event.shiftKey ? -1 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
      return;
    }
    // Keeps the focus inside when it is on something other than the input (a link, a chip).
    if (event.key !== 'Tab' || event.target === inputRef.current || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>('input, button, a[href]'),
    ].filter((element) => element.tabIndex >= 0);
    const at = focusable.indexOf(event.target as HTMLElement);
    const next = focusable.at((at + (event.shiftKey ? -1 : 1)) % focusable.length);
    event.preventDefault();
    next?.focus();
  }

  const status = !hasQuery
    ? undefined
    : !index
      ? 'Cargando índice…'
      : results && results.length === 0
        ? 'empty'
        : undefined;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Otherwise the click moves the focus to the page after it went back to the opener.
        event.preventDefault();
        onClose(true);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda rápida"
        className={styles.dialog}
        onKeyDown={handleDialogKeyDown}
      >
        <div className={styles.inputRow}>
          <svg
            className={styles.inputIcon}
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <label htmlFor={`${baseId}-input`} className="visually-hidden">
            Buscar en el grimorio
          </label>
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            type="search"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={selectedId}
            className={styles.input}
            placeholder="Busca un NPC, comando, varita, zona…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setSelectedKey(undefined);
            }}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className={styles.esc}>Esc</kbd>
        </div>

        {chips.length > 0 && (
          <div className={styles.chips} role="group" aria-label="Filtrar por tipo">
            {chips.map((kind) => (
              <button
                key={kind}
                type="button"
                // Reached with Tab from the input, which keeps the focus.
                tabIndex={-1}
                className={styles.chip}
                aria-pressed={kind === activeKind}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setKindFilter(kind);
                  setSelectedKey(undefined);
                }}
              >
                {kind === 'all' ? 'Todo' : KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
        <p className="visually-hidden" aria-live="polite">
          {hasQuery && results
            ? `${activeKind === 'all' ? 'Todo' : KIND_LABELS[activeKind]}: ${countLabel(groups)}`
            : ''}
        </p>

        <div className={styles.body}>
          <div className={styles.results}>
            {status === 'Cargando índice…' && <p className={styles.status}>{status}</p>}
            {status === 'empty' && (
              <p className={styles.status}>
                {`Nada con «${searched.trim()}». `}
                <Link to={searchPageTarget(searched)} onClick={() => onClose(false)}>
                  Buscar en la página de resultados
                </Link>
              </p>
            )}
            {!hasQuery && groups.length === 0 && (
              <p className={styles.status}>Escribe para buscar en el grimorio.</p>
            )}
            {groups.length > 0 && (
              <ResultGroups
                groups={groups}
                query={searched}
                terms={terms}
                listbox={{
                  id: listboxId,
                  label: 'Resultados',
                  selectedKey: selected?.key,
                  optionId,
                  onPick: pick,
                  onHover: setSelectedKey,
                }}
              />
            )}
          </div>
          {selected && (
            <div className={styles.previewColumn}>
              <PalettePreview option={selected} terms={terms} />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span aria-hidden="true">↑↓ navegar</span>
          <span aria-hidden="true">Enter abrir</span>
          <span aria-hidden="true">Ctrl+Enter fijar</span>
          <span aria-hidden="true">Esc cerrar</span>
          <span className={styles.notice} role="status">
            {notice && <span key={notice.id}>{notice.text}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Pins or recents as a group of the palette, whose keys don't clash with other groups. */
function savedGroup(key: string, label: string, items: readonly ResolvedItem[]): ResultGroup {
  return {
    key,
    kind: items[0]?.kind ?? 'pj',
    label,
    options: items.map((item) => ({
      key: `${key}:${item.key}`,
      kind: item.kind,
      result: resultOfItem(item),
    })),
  };
}

function countLabel(groups: readonly ResultGroup[]): string {
  const count = groups.reduce(
    (total, group) =>
      total + group.options.reduce((sum, option) => sum + ('more' in option ? option.more : 1), 0),
    0,
  );
  return count === 1 ? '1 resultado' : `${count} resultados`;
}
