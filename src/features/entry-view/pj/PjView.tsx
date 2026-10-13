import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, createSearchParams, useSearchParams } from 'react-router';
import type { EntryContext } from '@/content/content-queries';
import { normalize } from '@/content/normalize';
import { pjHistorialOf, pjSummaryOf, splitPjBody, type PjBody } from '@/content/pj-data';
import { ownNamesOf, type NameCount, type PjSummary } from '@/content/pj-historial';
import { PJ_ESTADO_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useContent } from '@/content/use-content';
import { useEntryBody } from '@/content/use-entry-body';
import { formatNumericDate } from '@/features/entry-list/entry-meta';
import { AsideBox, EntryAside } from '../EntryAside';
import { MarkdownBody } from '../EntryBody';
import { editorUrl } from '../editor-link';
import pageStyles from '../EntryPage.module.css';
import { HistorialPanel } from './HistorialPanel';
import styles from './PjView.module.css';

const TABS = [
  { id: 'historial', label: 'Historial' },
  { id: 'ficha', label: 'Ficha y trasfondo' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const EMPTY_SUMMARY: PjSummary = { total: 0, dms: [], companions: [], years: [] };
const TOP_DMS = 5;

interface PjViewProps {
  entry: EntryMeta<'pj'>;
  context: EntryContext;
  /** The page title, which EntryPage focuses when the DM moves to another entry. */
  title: ReactNode;
}

/**
 * /pj/:slug — header, key data, and the history and the sheet in two tabs. All of it comes
 * from the metadata at once except the text of the entries and the sheet, which come with the
 * PJ's body, loaded when the PJ opens.
 */
export function PjView({ entry, context, title }: PjViewProps) {
  const summary = pjSummaryOf(entry.slug) ?? EMPTY_SUMMARY;
  const items = pjHistorialOf(entry.slug);
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'ficha' ? 'ficha' : 'historial';
  const rawBody = useEntryBody(entry.path);
  const body = useMemo(
    () => (rawBody === undefined ? undefined : splitPjBody(rawBody, ownNamesOf(entry))),
    [rawBody, entry],
  );
  // Splits the entries little by little, so the first search of the history is instant.
  useEffect(() => body?.prepareWhenIdle(), [body]);

  function selectTab(next: TabId) {
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        if (next === 'historial') updated.delete('tab');
        else updated.set('tab', next);
        return updated;
      },
      { replace: true },
    );
  }

  const { estado, zona, hilo } = entry.data;
  const baseId = useId();
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  return (
    <div className={`${pageStyles.page} ${styles.page}`}>
      <div className={pageStyles.head}>
        <div className={pageStyles.titles}>
          <p className={pageStyles.kicker}>
            {'PJ · '}
            <span className={styles.estado} data-estado={estado}>
              <span aria-hidden="true">● </span>
              {PJ_ESTADO_LABELS[estado]}
            </span>
          </p>
          {title}
          <IdentityLine entry={entry} />
        </div>
        <div className={pageStyles.actions}>
          {import.meta.env.DEV && (
            <a
              className={pageStyles.secondaryButton}
              href={editorUrl(__REPO_ROOT__, entry.path)}
              title="Abrir esta ficha en VS Code"
            >
              Editar .md
            </a>
          )}
          {hilo && (
            <a
              className={pageStyles.secondaryButton}
              href={hilo}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hilo del foro <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>

      <dl className={styles.facts}>
        <Fact label="Última actividad">
          {summary.last ? formatNumericDate(summary.last) : 'Sin historial'}
        </Fact>
        <Fact label="Quests">{summary.total}</Fact>
        <Fact label="En juego desde">{summary.first ? formatNumericDate(summary.first) : '—'}</Fact>
        <Fact label="DMs distintos">{summary.dms.length}</Fact>
        {zona && (
          <Fact label="Origen">
            {context.zona ? (
              <Link className={styles.factLink} to={`/zona/${context.zona.slug}`}>
                {context.zona.data.title}
              </Link>
            ) : (
              zona
            )}
          </Fact>
        )}
      </dl>

      <Tabs
        tabs={TABS.map(({ id, label }) => ({
          id,
          label,
          count: id === 'historial' ? summary.total : undefined,
          tabId: tabId(id),
          panelId: panelId(id),
        }))}
        selected={tab}
        onSelect={selectTab}
      />

      <div className={styles.columns}>
        <div
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          className={styles.panel}
        >
          {tab === 'historial' ? (
            <HistorialPanel entry={entry} items={items} summary={summary} body={body} />
          ) : (
            <FichaTab entry={entry} body={body} />
          )}
        </div>
        <EntryAside
          context={context}
          before={summary.total > 0 && <PjAsideBoxes entry={entry} summary={summary} />}
        />
      </div>
    </div>
  );
}

/** Tags at once; the sheet once the body is loaded. */
function FichaTab({ entry, body }: { entry: EntryMeta<'pj'>; body: PjBody | undefined }) {
  const { tags = [] } = entry.data;
  return (
    <div className={styles.ficha}>
      {tags.length > 0 && (
        <ul className={pageStyles.tags} aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag}>
              <Link
                className={pageStyles.tag}
                to={{ pathname: '/pj', search: `?${createSearchParams({ tag })}` }}
              >
                {`#${tag}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!body ? (
        <p className={styles.loading} aria-busy="true">
          Cargando…
        </p>
      ) : body.fichaBody ? (
        <MarkdownBody markdown={body.fichaBody} />
      ) : (
        <p className={styles.loading}>Esta ficha todavía no tiene trasfondo.</p>
      )}
    </div>
  );
}

/** 'Humano · Bárbaro · Caótico Neutral · Skadi · cuenta Fernando10100'. */
function IdentityLine({ entry }: { entry: EntryMeta<'pj'> }) {
  const { raza, clases = [], alineamiento, deidad, cuenta_nwn } = entry.data;
  // 'Skadi, diosa de la tierra… (Deidad Menor)' → 'Skadi'; the whole text stays as a tooltip.
  const deidadName = deidad?.split(/[,(]/)[0].trim();
  const parts: ReactNode[] = [
    raza,
    clases.length > 0 ? clases.join(' / ') : undefined,
    alineamiento,
    deidadName ? (
      <span key="deidad" title={deidad}>
        {deidadName}
      </span>
    ) : undefined,
    <span key="cuenta" className={styles.nowrap}>
      cuenta <span className={styles.account}>{cuenta_nwn}</span>
    </span>,
  ].filter((part) => part !== undefined && part !== '');

  return (
    <p className={styles.identity}>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && ' · '}
          {part}
        </span>
      ))}
    </p>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  );
}

interface TabsProps {
  tabs: { id: TabId; label: string; count?: number; tabId: string; panelId: string }[];
  selected: TabId;
  onSelect: (id: TabId) => void;
}

/** ARIA tabs: one tab stop, arrows (and Home/End) move and select. */
function Tabs({ tabs, selected, onSelect }: TabsProps) {
  const refs = useRef(new Map<TabId, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(tabs[next].id);
    refs.current.get(tabs[next].id)?.focus();
  }

  return (
    <div role="tablist" aria-label="Secciones de la ficha" className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(element) => {
            if (element) refs.current.set(tab.id, element);
            else refs.current.delete(tab.id);
          }}
          type="button"
          role="tab"
          id={tab.tabId}
          aria-selected={tab.id === selected}
          aria-controls={tab.id === selected ? tab.panelId : undefined}
          tabIndex={tab.id === selected ? 0 : -1}
          className={styles.tab}
          onClick={() => onSelect(tab.id)}
          onKeyDown={handleKeyDown}
        >
          {tab.label}
          {tab.count !== undefined && <span className={styles.tabCount}> {tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** "Narrado por" and "Suele jugar con", before the boxes every entry has. */
function PjAsideBoxes({ entry, summary }: { entry: EntryMeta<'pj'>; summary: PjSummary }) {
  const [showAllDms, setShowAllDms] = useState(false);
  const { entries } = useContent();
  // A companion is a link when a PJ has that name as its title or one of its aliases.
  const pjByName = useMemo(() => {
    const map = new Map<string, EntryMeta>();
    for (const other of entries) {
      if (other.type !== 'pj' || other === entry) continue;
      for (const name of [other.data.title, ...(other.data.aliases ?? [])]) {
        if (!map.has(normalize(name))) map.set(normalize(name), other);
      }
    }
    return map;
  }, [entries, entry]);

  const dms = showAllDms ? summary.dms : summary.dms.slice(0, TOP_DMS);
  const listId = useId();

  return (
    <>
      <AsideBox title="Narrado por">
        <NameCountList id={listId} items={dms} />
        {summary.dms.length > TOP_DMS && (
          <button
            type="button"
            className={styles.showAll}
            aria-expanded={showAllDms}
            aria-controls={listId}
            onClick={() => setShowAllDms((value) => !value)}
          >
            {showAllDms ? 'Ver solo 5' : `Ver los ${summary.dms.length}`}{' '}
            <span aria-hidden="true">{showAllDms ? '↑' : '→'}</span>
          </button>
        )}
      </AsideBox>
      {summary.companions.length > 0 && (
        <AsideBox title="Suele jugar con">
          <NameCountList
            items={summary.companions}
            linkFor={(name) => {
              const pj = pjByName.get(normalize(name));
              return pj ? `/pj/${pj.slug}` : undefined;
            }}
          />
        </AsideBox>
      )}
    </>
  );
}

function NameCountList({
  id,
  items,
  linkFor,
}: {
  id?: string;
  items: readonly NameCount[];
  linkFor?: (name: string) => string | undefined;
}) {
  return (
    <ul id={id} className={styles.counts}>
      {items.map(({ name, count }) => {
        const to = linkFor?.(name);
        return (
          <li key={name} className={styles.countRow}>
            {to ? (
              <Link className={styles.countLink} to={to}>
                {name}
              </Link>
            ) : (
              <span>{name}</span>
            )}
            <span className={styles.countValue}>{count}</span>
          </li>
        );
      })}
    </ul>
  );
}
