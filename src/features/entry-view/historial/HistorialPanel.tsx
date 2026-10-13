import { useEffect, useEffectEvent, useId, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { queryTerms } from '@/content/highlight';
import { HISTORIAL_PROFILES, type HistorialType } from '@/content/historial';
import type { HistorialBody } from '@/content/historial-data';
import {
  previewSearchText,
  type HistorialItemMeta,
  type HistorialSummary,
} from '@/content/historial-items';
import type { EntryMeta } from '@/content/types';
import { scrollAndFlash } from '../scroll-to';
import { HistorialEntry } from './HistorialEntry';
import {
  groupHistorial,
  hasFilters,
  participantOptions,
  type HistorialFilters,
  type SearchTextOf,
} from './historial-filter';
import { countText, HISTORIAL_UI } from './historial-ui';
import styles from './HistorialPanel.module.css';

const DEBOUNCE_MS = 150;
/** More matches than this stay folded: opening them all would render hundreds of bodies. */
const AUTO_EXPAND_LIMIT = 25;

/** The URL parameters of the history; the list's filters (?zona=&estado=&tag=) are left alone. */
type HistorialParam = 'q' | 'dm' | 'autor' | 'con' | 'anio';

interface HistorialPanelProps {
  entry: EntryMeta<HistorialType>;
  /** The history without its text, in its type's order. */
  items: readonly HistorialItemMeta[];
  summary: HistorialSummary;
  /** The text of the entries; undefined while the entry's body loads. */
  body: HistorialBody | undefined;
}

/**
 * Search, filters and the history: a PJ's grouped by year, newest first; a crónica's annexes in
 * the order of the thread. Filters live in the URL. Everything but the text of an open entry
 * shows at once; until the body loads, the search looks into the previews.
 */
export function HistorialPanel({ entry, items, summary, body }: HistorialPanelProps) {
  const profile = HISTORIAL_PROFILES[entry.type];
  const ui = HISTORIAL_UI[entry.type];
  const byYear = profile.order === 'date';
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const urlQuery = params.get('q') ?? '';
  const author = params.get(ui.authorParam) || undefined;
  const con = (profile.participants && params.get('con')) || undefined;
  const year = (byYear && params.get('anio')) || undefined;

  function setParam(key: HistorialParam, value: string | undefined) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  // What is typed shows at once; the URL (and so the filtering) follows 150 ms later.
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    // The URL changed from outside (back button, another link): it wins over the box.
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  const commitQuery = useEffectEvent((value: string) => {
    setSyncedQuery(value.trim());
    setParam('q', value.trim());
  });
  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => commitQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, urlQuery]);

  const terms = useMemo(() => queryTerms(urlQuery), [urlQuery]);
  const filters = useMemo<HistorialFilters>(
    () => ({ terms, author, con, year }),
    [terms, author, con, year],
  );
  const ownNames = useMemo(() => [entry.data.title, ...(entry.data.aliases ?? [])], [entry.data]);
  const companions = useMemo(() => participantOptions(items, ownNames), [items, ownNames]);
  const searchTextOf = useMemo<SearchTextOf>(
    () =>
      body
        ? (item) => body.textOf(item.id)?.searchText ?? previewSearchText(item)
        : previewSearchText,
    [body],
  );

  // The entry a link points to (#h-…), or the entry of a block inside it (#h-…--clan).
  const anchor = decodeURIComponent(hash.slice(1));
  const target = useMemo(() => {
    const id = anchor.split('--')[0];
    return items.some((item) => item.id === id) ? id : undefined;
  }, [anchor, items]);

  const groups = useMemo(
    () => groupHistorial(items, filters, searchTextOf, { keep: target, byYear }),
    [items, filters, searchTextOf, target, byYear],
  );
  const visible = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const filtering = hasFilters(filters);
  const autoExpand = terms.length > 0 && visible.length <= AUTO_EXPAND_LIMIT;

  // Entries opened or closed by hand; forgotten when the search changes, so a new search
  // opens its own matches.
  const [toggled, setToggled] = useState<{ query: string; open: Map<string, boolean> }>({
    query: urlQuery,
    open: new Map(),
  });
  const openByHand = toggled.query === urlQuery ? toggled.open : undefined;
  const isOpen = (item: HistorialItemMeta) =>
    openByHand?.get(item.id) ?? (item.id === target || autoExpand);

  function setOpen(ids: readonly string[], open: boolean) {
    setToggled(({ query: previousQuery, open: previous }) => {
      const next = new Map(previousQuery === urlQuery ? previous : []);
      for (const id of ids) next.set(id, open);
      return { query: urlQuery, open: next };
    });
  }

  const anyClosed = visible.some((item) => !isOpen(item));

  // A link to an entry: open it (isOpen does), scroll to it and flash it once. A link to a block
  // inside it scrolls to the block, once the text that holds it is loaded.
  const toBlock = anchor !== target && body !== undefined;
  useEffect(() => {
    const article = target ? document.getElementById(target) : null;
    if (!article) return;
    const block = toBlock ? document.getElementById(anchor) : null;
    return block ? scrollAndFlash(block) : scrollAndFlash(article, article.querySelector('button'));
  }, [target, anchor, toBlock]);

  const searchId = useId();
  const countId = useId();

  const entryOf = (item: HistorialItemMeta) => (
    <HistorialEntry
      key={item.id}
      item={item}
      text={isOpen(item) ? body?.textOf(item.id) : undefined}
      type={entry.type}
      slug={entry.slug}
      terms={terms}
      open={isOpen(item)}
      onToggle={() => setOpen([item.id], !isOpen(item))}
    />
  );

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <svg
            className={styles.searchIcon}
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <label htmlFor={searchId} className="visually-hidden">
            {ui.searchLabel}
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={ui.searchPlaceholder}
            autoComplete="off"
            aria-describedby={countId}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span id={countId} className={styles.count} aria-live="polite">
            {terms.length > 0 ? matchesText(visible.length) : ''}
          </span>
        </div>

        <ChipSelect
          label={ui.authorLabel}
          allText={ui.authorAll}
          prefix={ui.authorPrefix}
          value={author}
          options={summary.dms}
          onChange={(value) => setParam(ui.authorParam, value)}
        />
        {profile.participants && (
          <ChipSelect
            label="Filtrar por compañero"
            allText="Con: cualquiera"
            prefix="Con"
            value={con}
            options={companions}
            onChange={(value) => setParam('con', value)}
          />
        )}
        <button
          type="button"
          className={styles.chip}
          disabled={visible.length === 0}
          onClick={() =>
            setOpen(
              visible.map((item) => item.id),
              anyClosed,
            )
          }
        >
          {anyClosed ? 'Expandir todo' : 'Plegar todo'}
        </button>
      </div>

      {byYear && summary.years.length > 1 && (
        <div className={styles.years} role="group" aria-label="Filtrar por año">
          <button
            type="button"
            className={styles.yearChip}
            aria-pressed={!year}
            onClick={() => setParam('anio', undefined)}
          >
            Todos
          </button>
          {summary.years.map(({ year: value, count }) => (
            <button
              key={value}
              type="button"
              className={styles.yearChip}
              aria-pressed={year === value}
              aria-label={`${value}, ${countText(ui, count)}`}
              onClick={() => setParam('anio', year === value ? undefined : value)}
            >
              {`${value} · ${count}`}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className={styles.empty}>{items.length === 0 ? ui.empty : ui.noMatches}</p>
      ) : byYear ? (
        groups.map((group) => (
          <section key={group.year} className={styles.group} aria-labelledby={`anio-${group.year}`}>
            <h2 id={`anio-${group.year}`} className={styles.groupTitle}>
              {group.year}{' '}
              <span className={styles.groupCount}>
                {filtering
                  ? `· ${group.items.length} de ${group.total} coinciden`
                  : `· ${countText(ui, group.total)}`}
              </span>
            </h2>
            {group.items.map(entryOf)}
          </section>
        ))
      ) : (
        <div className={styles.group}>{groups.flatMap((group) => group.items).map(entryOf)}</div>
      )}
    </div>
  );
}

function matchesText(count: number): string {
  return count === 1 ? '1 coincidencia' : `${count} coincidencias`;
}

interface ChipSelectProps {
  label: string;
  allText: string;
  prefix: string;
  value: string | undefined;
  options: readonly { name: string; count: number }[];
  onChange: (value: string | undefined) => void;
}

/** A native <select> dressed as a chip, as the list filters (T05). */
function ChipSelect({ label, allText, prefix, value, options, onChange }: ChipSelectProps) {
  const id = useId();
  const isUnknown = value !== undefined && !options.some((option) => option.name === value);
  return (
    <span className={styles.selectChip} data-active={value ? '' : undefined}>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">{allText}</option>
        {isUnknown && <option value={value}>{`${prefix}: ${value}`}</option>}
        {options.map((option) => (
          <option key={option.name} value={option.name}>
            {`${prefix}: ${option.name} (${option.count})`}
          </option>
        ))}
      </select>
    </span>
  );
}
