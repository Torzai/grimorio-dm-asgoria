import { useId, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  FILTER_KEYS,
  countByType,
  filterKeysFor,
  getFilterOptions,
  getZoneTitles,
  listEntries,
  type EntryFilters,
  type FilterKey,
  type FilterValue,
} from '@/content/content-queries';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta, EntryType } from '@/content/types';
import { useContent } from '@/content/use-content';
import { getEntryMeta } from './entry-meta';
import styles from './EntryListColumn.module.css';

const FILTER_TEXT: Record<FilterKey, { name: string; all: string }> = {
  zona: { name: 'zona', all: 'Zona: todas' },
  faccion: { name: 'facción', all: 'Facción: todas' },
  estado: { name: 'estado', all: 'Estado: todos' },
  tag: { name: 'tag', all: 'Tag: todas' },
};

interface EntryListColumnProps {
  type: EntryType;
  /** Slug of the entry open next to the list, if any. */
  activeSlug?: string;
}

/**
 * Filter chips, count line and cards for one type. Filters live in the URL
 * (?zona=&faccion=&estado=&tag=).
 */
export function EntryListColumn({ type, activeSlug }: EntryListColumnProps) {
  const { entries } = useContent();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams, type), [searchParams, type]);
  // Only the list's filters travel to the entry; the open entry's own parameters (a PJ's
  // ?tab= or history search) would make no sense in another one.
  const search = useMemo(() => {
    const kept = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) kept.set(key, value);
    }
    const text = kept.toString();
    return text ? `?${text}` : '';
  }, [searchParams]);
  const hasFilters = Object.keys(filters).length > 0;
  const total = useMemo(() => countByType(entries)[type], [entries, type]);
  const visible = useMemo(() => listEntries(entries, type, filters), [entries, type, filters]);
  const groups = useMemo(() => getFilterOptions(entries, type), [entries, type]);
  const zoneTitles = useMemo(() => getZoneTitles(entries), [entries]);

  // A filter is offered when it has values, or when the URL asks for it anyway,
  // so a stale ?zona=… is visible and can be undone instead of silently emptying the list.
  const selects = filterKeysFor(type).flatMap((key) => {
    const values = groups.find((group) => group.key === key)?.values ?? [];
    const selected = filters[key];
    return values.length > 0 || selected ? [{ key, values, selected }] : [];
  });

  function updateParams(change: (params: URLSearchParams) => void) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      change(next);
      return next;
    });
  }

  function setFilter(key: FilterKey, value: string) {
    updateParams((params) => (value ? params.set(key, value) : params.delete(key)));
  }

  function clearFilters() {
    updateParams((params) => FILTER_KEYS.forEach((key) => params.delete(key)));
  }

  const Heading = activeSlug === undefined ? 'h1' : 'h2';
  const noun = (count: number) => (count === 1 ? 'ficha' : 'fichas');
  const countText = hasFilters
    ? `${visible.length} de ${total} ${noun(total)}`
    : `${total} ${noun(total)}`;
  const orderText = type === 'sesion' ? 'orden cronológico' : 'orden alfabético';
  const headingId = useId();

  return (
    <section className={styles.column} aria-labelledby={headingId}>
      <Heading id={headingId} className="visually-hidden">
        {TYPE_LABELS[type].plural}
      </Heading>

      <div className={styles.filters}>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={!hasFilters}
          onClick={clearFilters}
        >
          Todos
        </button>
        {selects.map(({ key, values, selected }) => (
          <FilterSelect
            key={key}
            filterKey={key}
            values={values}
            selected={selected}
            onChange={(value) => setFilter(key, value)}
          />
        ))}
      </div>

      <p className={styles.subtitle} aria-live="polite">
        {`${countText} · ${orderText}`}
      </p>

      {visible.length > 0 ? (
        <ul className={styles.cards}>
          {visible.map((entry) => (
            <li key={entry.slug}>
              <EntryCard
                entry={entry}
                search={search}
                active={entry.slug === activeSlug}
                zoneTitles={zoneTitles}
              />
            </li>
          ))}
        </ul>
      ) : hasFilters ? (
        <div className={styles.empty}>
          <p>No hay fichas con estos filtros</p>
          <button type="button" className={styles.clear} onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <p className={styles.empty}>Todavía no hay fichas de este tipo.</p>
      )}
    </section>
  );
}

/** The filters in the URL that apply to this type; empty values count as unset. */
function readFilters(params: URLSearchParams, type: EntryType): EntryFilters {
  const filters: EntryFilters = {};
  for (const key of filterKeysFor(type)) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

interface FilterSelectProps {
  filterKey: FilterKey;
  values: FilterValue[];
  selected: string | undefined;
  onChange: (value: string) => void;
}

/** A native <select> dressed as a chip; the chip turns gold while a value is chosen. */
function FilterSelect({ filterKey, values, selected, onChange }: FilterSelectProps) {
  const id = useId();
  const text = FILTER_TEXT[filterKey];
  // Not among the offered values (e.g. a typo in the URL): still shown, so the chip tells the truth.
  const isUnknown = selected !== undefined && !values.some((option) => option.value === selected);

  return (
    <span className={styles.selectChip} data-active={selected ? '' : undefined}>
      <label htmlFor={id} className="visually-hidden">
        Filtrar por {text.name}
      </label>
      <select
        id={id}
        className={styles.select}
        value={selected ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{text.all}</option>
        {isUnknown && <option value={selected}>{selected}</option>}
        {values.map((option) => (
          <option key={option.value} value={option.value}>
            {`${option.label} (${option.count})`}
          </option>
        ))}
      </select>
    </span>
  );
}

interface EntryCardProps {
  entry: EntryMeta;
  /** Query string of the current URL, kept so opening an entry doesn't drop the filters. */
  search: string;
  active: boolean;
  zoneTitles: ReadonlyMap<string, string>;
}

function EntryCard({ entry, search, active, zoneTitles }: EntryCardProps) {
  const meta = getEntryMeta(entry, zoneTitles);
  const { resumen } = entry.data;

  return (
    <Link
      className={styles.card}
      to={{ pathname: `/${entry.type}/${entry.slug}`, search }}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.cardTitle}>{entry.data.title}</span>
      {meta.length > 0 && <span className={styles.cardMeta}>{meta.join(' · ')}</span>}
      {resumen && <span className={styles.cardSummary}>{resumen}</span>}
    </Link>
  );
}
