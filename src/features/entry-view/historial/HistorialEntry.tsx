import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { findRanges } from '@/content/highlight';
import { HISTORIAL_PROFILES, type HistorialType } from '@/content/historial';
import type { HistorialItemMeta, HistorialItemText } from '@/content/historial-items';
import { formatNumericDate } from '@/features/entry-list/entry-meta';
import { PinIconButton } from '@/features/pins/PinButton';
import { historialItem } from '@/features/pins/saved-items';
import { MarkdownBody } from '../EntryBody';
import { BlockIndex, BlockSections } from '../ThematicBlocks';
import { HISTORIAL_UI } from './historial-ui';
import styles from './HistorialPanel.module.css';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MAX_CHIPS = 6;
const COPIED_MS = 2000;
/** An open entry gets a mini-index from this many thematic blocks on. */
const MIN_INDEXED_BLOCKS = 2;

interface HistorialEntryProps {
  item: HistorialItemMeta;
  /** The text of the open entry; undefined while the body loads. */
  text: HistorialItemText | undefined;
  /** Type and slug of the entry the history belongs to, for the entry's link and pin. */
  type: HistorialType;
  slug: string;
  terms: readonly string[];
  open: boolean;
  onToggle: () => void;
}

/**
 * One history entry: a head that opens the whole text when clicked. A PJ's quest shows its date,
 * narrator, participants (linked when they are a PJ) and preview; a crónica's annex, its title,
 * author, dates and preview, and a mini-index when its text has thematic blocks. Folded entries
 * don't render their body.
 */
export function HistorialEntry({
  item,
  text,
  type,
  slug,
  terms,
  open,
  onToggle,
}: HistorialEntryProps) {
  const titled = HISTORIAL_PROFILES[type].entryTitle === 'detected';
  const bodyId = `${item.id}-texto`;
  const blocks = text?.blocks;

  return (
    <article
      id={item.id}
      className={styles.entry}
      data-open={open ? '' : undefined}
      data-titled={titled ? '' : undefined}
    >
      <div className={styles.entryTop}>
        {/* The button covers the whole head; the participant links sit above it. */}
        <div className={styles.entryHead}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={open ? bodyId : undefined}
            onClick={onToggle}
          >
            <span className="visually-hidden">{toggleLabel(item, titled)}</span>
          </button>
          {titled ? (
            <TitledSummary item={item} terms={terms} open={open} />
          ) : (
            <DatedSummary item={item} terms={terms} open={open} />
          )}
          <span className={styles.caret} aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </div>
        {open && (
          <div className={styles.entryPin}>
            <PinIconButton item={historialItem(type, slug, item.id)} />
          </div>
        )}
      </div>

      {open && (
        <div id={bodyId} className={styles.entryBody}>
          {!text ? (
            <p className={styles.noText} aria-busy="true">
              Cargando…
            </p>
          ) : blocks && blocks.blocks.length >= MIN_INDEXED_BLOCKS ? (
            <>
              <BlockIndex blocks={blocks.blocks} title="Índice del anexo" />
              {blocks.intro && <MarkdownBody markdown={blocks.intro} highlight={terms} />}
              <BlockSections blocks={blocks.blocks} terms={terms} />
            </>
          ) : text.bodyMarkdown ? (
            <MarkdownBody markdown={text.bodyMarkdown} highlight={terms} />
          ) : (
            <p className={styles.noText}>Esta entrada no tiene más texto.</p>
          )}
          <div className={styles.entryFoot}>
            {item.recompensa && (
              <p className={styles.reward}>
                <span className={styles.rewardLabel}>Recompensa</span>{' '}
                <span className={styles.rewardText}>
                  <Highlighted text={item.recompensa} terms={terms} />
                </span>
              </p>
            )}
            <CopyLink path={`/${type}/${slug}`} id={item.id} label={HISTORIAL_UI[type].copyLink} />
          </div>
        </div>
      )}
    </article>
  );
}

function toggleLabel(item: HistorialItemMeta, titled: boolean): string {
  if (titled) {
    return `${item.title ?? 'Anexo'}, de ${item.authorName}, ${formatNumericDate(item.date)}`;
  }
  const [year, month, day] = item.date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}, narró ${item.authorName}`;
}

interface SummaryProps {
  item: HistorialItemMeta;
  terms: readonly string[];
  open: boolean;
}

/** A quest: the date in a column, then narrator, participants and preview. */
function DatedSummary({ item, terms, open }: SummaryProps) {
  const [year, month, day] = item.date.split('-');
  const extra = item.participantes.length - MAX_CHIPS;
  return (
    <>
      <time className={styles.date} dateTime={item.date} aria-hidden="true">
        <span className={styles.day}>{day}</span>
        <span className={styles.monthYear}>{`${MONTHS[Number(month) - 1]} ${year}`}</span>
      </time>
      <span className={styles.summary}>
        <span className={styles.narrator} aria-hidden="true">
          Narró <span className={styles.narratorName}>{item.authorName}</span>
        </span>
        {item.participantes.length > 0 && (
          <span className={styles.participants}>
            {item.participantes.slice(0, MAX_CHIPS).map((name, index) => {
              const pj = item.participantesPj?.[index];
              const label = <Highlighted text={name} terms={terms} />;
              return pj ? (
                <Link
                  key={name}
                  className={`${styles.participant} ${styles.participantLink}`}
                  to={`/pj/${pj}`}
                >
                  {label}
                </Link>
              ) : (
                <span key={name} className={styles.participant}>
                  {label}
                </span>
              );
            })}
            {extra > 0 && (
              <span className={styles.more} title={item.participantes.slice(MAX_CHIPS).join(', ')}>
                {`+${extra}`}
              </span>
            )}
          </span>
        )}
        {/* Open, the body starts with the same text. */}
        {!open && item.preview && (
          <span className={styles.preview}>
            <Highlighted text={item.preview} terms={terms} />
          </span>
        )}
      </span>
    </>
  );
}

/** An annex: its title, '<author> · DD/MM/AAAA · editado DD/MM/AAAA' and the preview. */
function TitledSummary({ item, terms, open }: SummaryProps) {
  // An edit on the day of the post is no news.
  const edited = item.editedAt && item.editedAt !== item.date ? item.editedAt : undefined;
  return (
    <span className={styles.summary} aria-hidden="true">
      <span className={styles.entryTitle}>
        <Highlighted text={item.title ?? 'Anexo'} terms={terms} />
      </span>
      <span className={styles.narrator}>
        <span className={styles.narratorName}>{item.authorName}</span>
        {` · ${formatNumericDate(item.date)}`}
        {edited && ` · editado ${formatNumericDate(edited)}`}
      </span>
      {!open && item.preview && (
        <span className={styles.preview}>
          <Highlighted text={item.preview} terms={terms} />
        </span>
      )}
    </span>
  );
}

/** Copies the address of the entry (<path>#<id>) to the clipboard. */
function CopyLink({ path, id, label }: { path: string; id: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  function copy() {
    const url = `${window.location.origin}${path}#${id}`;
    navigator.clipboard.writeText(url).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  }

  return (
    <button type="button" className={styles.copy} onClick={copy}>
      <span aria-live="polite">
        {state === 'copied' ? 'Enlace copiado' : state === 'failed' ? 'No se pudo copiar' : label}
      </span>{' '}
      <span aria-hidden="true">⧉</span>
    </button>
  );
}

/** Plain text with every match of the terms wrapped in <mark>. */
function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  const ranges = findRanges(text, terms);
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let from = 0;
  for (const [start, end] of ranges) {
    parts.push(text.slice(from, start), <mark key={start}>{text.slice(start, end)}</mark>);
    from = end;
  }
  parts.push(text.slice(from));
  return parts;
}
