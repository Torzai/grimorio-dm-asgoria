import { useEffect, useEffectEvent, useId, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { HistorialItem, PjHistorialData, PjSummary } from '@/content/pj-historial';
import type { Entry } from '@/content/types';
import { HistorialEntry } from './HistorialEntry';
import {
  groupHistorial,
  hasFilters,
  participantOptions,
  type HistorialFilters,
} from './historial-filter';
import { queryTerms } from './highlight';
import styles from './HistorialPanel.module.css';

const DEBOUNCE_MS = 150;
/** More matches than this stay folded: opening them all would render hundreds of bodies. */
const AUTO_EXPAND_LIMIT = 25;

/** The URL parameters of the history; the list's filters (?zona=&estado=&tag=) are left alone. */
type HistorialParam = 'q' | 'dm' | 'con' | 'anio';

interface HistorialPanelProps {
  entry: Entry<'pj'>;
  data: PjHistorialData;
  summary: PjSummary;
}

/** Search, filters and the history grouped by year. Filters live in the URL. */
export function HistorialPanel({ entry, data, summary }: HistorialPanelProps) {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const urlQuery = params.get('q') ?? '';
  const dm = params.get('dm') || undefined;
  const con = params.get('con') || undefined;
  const year = params.get('anio') || undefined;

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
    () => ({ terms, dm, con, year }),
    [terms, dm, con, year],
  );
  const ownNames = useMemo(() => [entry.data.title, ...(entry.data.aliases ?? [])], [entry.data]);
  const companions = useMemo(
    () => participantOptions(data.items, ownNames),
    [data.items, ownNames],
  );

  // The entry a link points to (#h-…), when it exists.
  const target = useMemo(() => {
    const id = decodeURIComponent(hash.slice(1));
    return data.items.some((item) => item.id === id) ? id : undefined;
  }, [hash, data.items]);

  const groups = useMemo(
    () => groupHistorial(data.items, filters, target),
    [data.items, filters, target],
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
  const isOpen = (item: HistorialItem) =>
    openByHand?.get(item.id) ?? (item.id === target || autoExpand);

  function setOpen(ids: readonly string[], open: boolean) {
    setToggled(({ query: previousQuery, open: previous }) => {
      const next = new Map(previousQuery === urlQuery ? previous : []);
      for (const id of ids) next.set(id, open);
      return { query: urlQuery, open: next };
    });
  }

  const anyClosed = visible.some((item) => !isOpen(item));

  // A link to an entry: open it (isOpen does), scroll to it and flash it once.
  useEffect(() => {
    const article = target ? document.getElementById(target) : null;
    if (!article) return;
    article.scrollIntoView({ block: 'start' });
    article.querySelector('button')?.focus({ preventScroll: true });
    article.dataset.flash = '';
    const stop = () => delete article.dataset.flash;
    article.addEventListener('animationend', stop, { once: true });
    return () => {
      article.removeEventListener('animationend', stop);
      stop();
    };
  }, [target]);

  const searchId = useId();
  const countId = useId();

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
            Buscar en el historial
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder="Buscar en el historial…"
            autoComplete="off"
            aria-describedby={countId}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span id={countId} className={styles.count} aria-live="polite">
            {terms.length > 0 ? matchesText(visible.length) : ''}
          </span>
        </div>

        <ChipSelect
          label="Filtrar por DM"
          allText="DM: todos"
          prefix="DM"
          value={dm}
          options={summary.dms}
          onChange={(value) => setParam('dm', value)}
        />
        <ChipSelect
          label="Filtrar por compañero"
          allText="Con: cualquiera"
          prefix="Con"
          value={con}
          options={companions}
          onChange={(value) => setParam('con', value)}
        />
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

      {summary.years.length > 1 && (
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
              aria-label={`${value}, ${entriesText(count)}`}
              onClick={() => setParam('anio', year === value ? undefined : value)}
            >
              {`${value} · ${count}`}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className={styles.empty}>
          {data.items.length === 0
            ? 'Este PJ todavía no tiene historial.'
            : 'Ninguna entrada coincide con la búsqueda y los filtros.'}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.year} className={styles.group} aria-labelledby={`anio-${group.year}`}>
            <h2 id={`anio-${group.year}`} className={styles.groupTitle}>
              {group.year}{' '}
              <span className={styles.groupCount}>
                {filtering
                  ? `· ${group.items.length} de ${group.total} coinciden`
                  : `· ${entriesText(group.total)}`}
              </span>
            </h2>
            {group.items.map((item) => (
              <HistorialEntry
                key={item.id}
                item={item}
                slug={entry.slug}
                terms={terms}
                open={isOpen(item)}
                onToggle={() => setOpen([item.id], !isOpen(item))}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function matchesText(count: number): string {
  return count === 1 ? '1 coincidencia' : `${count} coincidencias`;
}

function entriesText(count: number): string {
  return count === 1 ? '1 entrada' : `${count} entradas`;
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
