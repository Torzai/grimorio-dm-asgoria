import { useEffect, useId, useMemo, type ReactNode } from 'react';
import { Link, createSearchParams, useSearchParams } from 'react-router';
import type { EntryContext } from '@/content/content-queries';
import {
  historialItemsOf,
  historialSummaryOf,
  splitHistorialBody,
  type HistorialBody,
} from '@/content/historial-data';
import { ownNamesOf, type HistorialSummary } from '@/content/historial-items';
import { PJ_ESTADO_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useEntryBody } from '@/content/use-entry-body';
import { formatNumericDate } from '@/features/entry-list/entry-meta';
import { PinButton } from '@/features/pins/PinButton';
import { AsideBox, EntryAside } from '../EntryAside';
import { MarkdownBody } from '../EntryBody';
import { editorUrl } from '../editor-link';
import pageStyles from '../EntryPage.module.css';
import { EntryTabs } from '../EntryTabs';
import tabStyles from '../EntryTabs.module.css';
import { HistorialPanel } from '../historial/HistorialPanel';
import { NameCountList, NarratorsBox } from '../historial/NameCountList';
import styles from './PjView.module.css';

const TABS = [
  { id: 'historial', label: 'Historial' },
  { id: 'ficha', label: 'Ficha y trasfondo' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const EMPTY_SUMMARY: HistorialSummary = { total: 0, dms: [], companions: [], years: [] };

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
  const summary = historialSummaryOf(entry.slug) ?? EMPTY_SUMMARY;
  const items = historialItemsOf(entry.slug);
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'ficha' ? 'ficha' : 'historial';
  const rawBody = useEntryBody(entry.path);
  const body = useMemo(
    () =>
      rawBody === undefined ? undefined : splitHistorialBody(rawBody, 'pj', ownNamesOf(entry)),
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
          <PinButton item={{ type: 'pj', slug: entry.slug }} />
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

      <EntryTabs
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

      <div className={tabStyles.columns}>
        <div
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          className={tabStyles.panel}
        >
          {tab === 'historial' ? (
            <HistorialPanel entry={entry} items={items} summary={summary} body={body} />
          ) : (
            <FichaTab entry={entry} body={body} />
          )}
        </div>
        <EntryAside
          context={context}
          before={summary.total > 0 && <PjAsideBoxes summary={summary} />}
        />
      </div>
    </div>
  );
}

/** Tags at once; the sheet once the body is loaded. */
function FichaTab({ entry, body }: { entry: EntryMeta<'pj'>; body: HistorialBody | undefined }) {
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
        <p className={tabStyles.loading} aria-busy="true">
          Cargando…
        </p>
      ) : body.fichaBody ? (
        <MarkdownBody markdown={body.fichaBody} />
      ) : (
        <p className={tabStyles.loading}>Esta ficha todavía no tiene trasfondo.</p>
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

/** "Narrado por" and "Suele jugar con", before the boxes every entry has. */
function PjAsideBoxes({ summary }: { summary: HistorialSummary }) {
  return (
    <>
      <NarratorsBox narrators={summary.dms} />
      {summary.companions.length > 0 && (
        <AsideBox title="Suele jugar con">
          <NameCountList
            items={summary.companions}
            linkFor={({ name, pj, ambiguous }) =>
              pj
                ? { to: `/pj/${pj}` }
                : ambiguous
                  ? {
                      to: {
                        pathname: '/buscar',
                        search: `?${createSearchParams({ q: name, type: 'pj' })}`,
                      },
                      title: 'Varios PJ se llaman así',
                    }
                  : undefined
            }
          />
        </AsideBox>
      )}
    </>
  );
}
