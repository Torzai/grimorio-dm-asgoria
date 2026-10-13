import { useEffect, useId, useMemo, type ReactNode } from 'react';
import { Link, createSearchParams, useLocation, useSearchParams } from 'react-router';
import type { EntryContext } from '@/content/content-queries';
import {
  parseSituacion,
  SITUACION_ANCHOR,
  type CronicaMeta,
  type Situacion,
} from '@/content/cronica';
import { cronicaMetaOf } from '@/content/cronica-data';
import { historialItemsOf, historialSummaryOf, splitHistorialBody } from '@/content/historial-data';
import { ownNamesOf, type HistorialSummary } from '@/content/historial-items';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useEntryBody } from '@/content/use-entry-body';
import { formatNumericDate } from '@/features/entry-list/entry-meta';
import { PinButton } from '@/features/pins/PinButton';
import { EntryAside } from '../EntryAside';
import { MarkdownBody } from '../EntryBody';
import { editorUrl } from '../editor-link';
import pageStyles from '../EntryPage.module.css';
import { EntryTabs } from '../EntryTabs';
import tabStyles from '../EntryTabs.module.css';
import { HistorialPanel } from '../historial/HistorialPanel';
import { NarratorsBox } from '../historial/NameCountList';
import { scrollAndFlash } from '../scroll-to';
import { BlockIndex, BlockSections } from '../ThematicBlocks';
import styles from './CronicaView.module.css';

const TABS = [
  { id: 'situacion', label: 'Situación' },
  { id: 'anexos', label: 'Anexos' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const EMPTY_SUMMARY: HistorialSummary = { total: 0, dms: [], companions: [], years: [] };
/** The situation gets an index from this many blocks on. */
const MIN_INDEXED_BLOCKS = 2;

interface CronicaViewProps {
  entry: EntryMeta<'cronica'>;
  context: EntryContext;
  /** The page title, which EntryPage focuses when the DM moves to another entry. */
  title: ReactNode;
}

/**
 * /cronica/:slug — header, the situation (post #1, split in thematic blocks with an index) and
 * the annexes (the replies, in thread order) in two tabs. The index, the dates and the annexes'
 * heads come from the metadata at once; their texts come with the body, loaded when it opens.
 */
export function CronicaView({ entry, context, title }: CronicaViewProps) {
  const meta = cronicaMetaOf(entry.slug);
  const summary = historialSummaryOf(entry.slug) ?? EMPTY_SUMMARY;
  const items = historialItemsOf(entry.slug);
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const anchor = decodeURIComponent(hash.slice(1));
  // A link to an annex (#h-…, or #h-…--<block> inside it) opens the annexes without ?tab=.
  const toAnnex = items.some((item) => item.id === anchor.split('--')[0]);
  const tabParam = params.get('tab');
  const tab: TabId =
    tabParam === 'anexos' || (tabParam !== 'situacion' && toAnnex) ? 'anexos' : 'situacion';

  const rawBody = useEntryBody(entry.path);
  const body = useMemo(
    () =>
      rawBody === undefined ? undefined : splitHistorialBody(rawBody, 'cronica', ownNamesOf(entry)),
    [rawBody, entry],
  );
  const situacion = useMemo(() => body && parseSituacion(body.fichaBody), [body]);
  // Splits the annexes little by little, so the first search of them is instant.
  useEffect(() => body?.prepareWhenIdle(), [body]);

  // A link to a block of the situation (#s-…): scroll to it once its text is there.
  useEffect(() => {
    if (tab !== 'situacion' || !situacion || !anchor) return;
    const block = document.getElementById(anchor);
    return block ? scrollAndFlash(block) : undefined;
  }, [tab, situacion, anchor]);

  function selectTab(next: TabId) {
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        // The situation is the default, unless the address points to an annex.
        if (next === 'situacion' && !toAnnex) updated.delete('tab');
        else updated.set('tab', next);
        return updated;
      },
      { replace: true },
    );
  }

  const { hilo, resumen } = entry.data;
  const baseId = useId();
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  return (
    <div className={`${pageStyles.page} ${styles.page}`}>
      <div className={pageStyles.head}>
        <div className={pageStyles.titles}>
          <p className={pageStyles.kicker}>
            {TYPE_LABELS.cronica.singular}
            {context.zona && (
              <>
                {' · '}
                <Link className={pageStyles.kickerLink} to={`/zona/${context.zona.slug}`}>
                  {context.zona.data.title}
                </Link>
              </>
            )}
          </p>
          {title}
          <p className={styles.updated}>
            {meta?.updated
              ? `Última actualización ${formatNumericDate(meta.updated)}`
              : 'Sin fecha de actualización'}
          </p>
          {resumen && <p className={pageStyles.subtitle}>{resumen}</p>}
        </div>
        <div className={pageStyles.actions}>
          <PinButton item={{ type: 'cronica', slug: entry.slug }} />
          {import.meta.env.DEV && (
            <a
              className={pageStyles.secondaryButton}
              href={editorUrl(__REPO_ROOT__, entry.path)}
              title="Abrir esta ficha en VS Code"
            >
              Editar .md
            </a>
          )}
          <a
            className={pageStyles.secondaryButton}
            href={hilo}
            target="_blank"
            rel="noopener noreferrer"
          >
            Hilo del foro <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <EntryTabs
        tabs={TABS.map(({ id, label }) => ({
          id,
          label,
          count: id === 'anexos' ? summary.total : undefined,
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
          {tab === 'situacion' ? (
            <SituacionTab entry={entry} meta={meta} situacion={situacion} />
          ) : (
            <HistorialPanel entry={entry} items={items} summary={summary} body={body} />
          )}
        </div>
        <EntryAside
          context={context}
          before={meta && meta.narrators.length > 0 && <NarratorsBox narrators={meta.narrators} />}
        />
      </div>
    </div>
  );
}

interface SituacionTabProps {
  entry: EntryMeta<'cronica'>;
  meta: CronicaMeta | undefined;
  /** Undefined while the body loads. */
  situacion: Situacion | undefined;
}

/** Who wrote it and when, the index at once; the blocks once the body is loaded; then the tags. */
function SituacionTab({ entry, meta, situacion }: SituacionTabProps) {
  const { tags = [] } = entry.data;
  const index = meta?.situacion.blocks ?? [];
  const isEmpty = situacion && !situacion.intro && situacion.blocks.length === 0 && !situacion.rest;

  return (
    <div className={styles.situacion}>
      {meta && <Byline situacion={meta.situacion} />}
      {index.length >= MIN_INDEXED_BLOCKS && <BlockIndex blocks={index} title="Índice" />}
      {!situacion ? (
        <p className={tabStyles.loading} aria-busy="true">
          Cargando…
        </p>
      ) : isEmpty ? (
        <p className={tabStyles.loading}>Esta ficha todavía no tiene situación.</p>
      ) : (
        <>
          {situacion.intro && (
            <BlockSections
              blocks={[{ id: SITUACION_ANCHOR, label: 'Situación', markdown: situacion.intro }]}
            />
          )}
          <BlockSections blocks={situacion.blocks} />
          {situacion.rest && <MarkdownBody markdown={situacion.rest} />}
        </>
      )}
      {tags.length > 0 && (
        <ul className={pageStyles.tags} aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag}>
              <Link
                className={pageStyles.tag}
                to={{ pathname: '/cronica', search: `?${createSearchParams({ tag })}` }}
              >
                {`#${tag}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 'She Wolf · publicado 17/12/2022 · editado 28/04/2025'. */
function Byline({ situacion }: { situacion: CronicaMeta['situacion'] }) {
  const { authorName, publishedAt, editedAt } = situacion;
  const parts = [
    authorName,
    publishedAt && `publicado ${formatNumericDate(publishedAt)}`,
    editedAt && editedAt !== publishedAt && `editado ${formatNumericDate(editedAt)}`,
  ].filter((part) => typeof part === 'string' && part !== '');
  if (parts.length === 0) return null;
  return <p className={styles.byline}>{parts.join(' · ')}</p>;
}
