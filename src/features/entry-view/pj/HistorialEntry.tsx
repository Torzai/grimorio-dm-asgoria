import { useEffect, useState, type ReactNode } from 'react';
import { findRanges } from '@/content/highlight';
import type { HistorialItemMeta, HistorialItemText } from '@/content/pj-historial';
import { PinIconButton } from '@/features/pins/PinButton';
import { historialItem } from '@/features/pins/saved-items';
import { MarkdownBody } from '../EntryBody';
import styles from './HistorialPanel.module.css';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MAX_CHIPS = 6;
const COPIED_MS = 2000;

interface HistorialEntryProps {
  item: HistorialItemMeta;
  /** The text of the open entry; undefined while the PJ's body loads. */
  text: HistorialItemText | undefined;
  /** The PJ's slug, for the entry's link. */
  slug: string;
  terms: readonly string[];
  open: boolean;
  onToggle: () => void;
}

/**
 * One history entry: a button with date, narrator, participants and preview that opens the
 * whole text. Folded entries don't render their body.
 */
export function HistorialEntry({ item, text, slug, terms, open, onToggle }: HistorialEntryProps) {
  const [year, month, day] = item.date.split('-');
  const bodyId = `${item.id}-texto`;
  const extra = item.participantes.length - MAX_CHIPS;

  return (
    <article id={item.id} className={styles.entry} data-open={open ? '' : undefined}>
      <div className={styles.entryTop}>
        <button
          type="button"
          className={styles.entryHead}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={onToggle}
        >
          <time className={styles.date} dateTime={item.date}>
            <span className={styles.day}>{day}</span>
            <span className={styles.monthYear}>{`${MONTHS[Number(month) - 1]} ${year}`}</span>
          </time>
          <span className={styles.summary}>
            <span className={styles.narrator}>
              Narró <span className={styles.narratorName}>{item.authorName}</span>
            </span>
            {item.participantes.length > 0 && (
              <span className={styles.participants}>
                {item.participantes.slice(0, MAX_CHIPS).map((name) => (
                  <span key={name} className={styles.participant}>
                    <Highlighted text={name} terms={terms} />
                  </span>
                ))}
                {extra > 0 && (
                  <span
                    className={styles.more}
                    title={item.participantes.slice(MAX_CHIPS).join(', ')}
                  >
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
          <span className={styles.caret} aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>
        {open && (
          <div className={styles.entryPin}>
            <PinIconButton item={historialItem(slug, item.id)} />
          </div>
        )}
      </div>

      {open && (
        <div id={bodyId} className={styles.entryBody}>
          {!text ? (
            <p className={styles.noText} aria-busy="true">
              Cargando…
            </p>
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
            <CopyLink slug={slug} id={item.id} />
          </div>
        </div>
      )}
    </article>
  );
}

/** Copies the address of the entry (/pj/<slug>#<id>) to the clipboard. */
function CopyLink({ slug, id }: { slug: string; id: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  function copy() {
    const url = `${window.location.origin}/pj/${slug}#${id}`;
    navigator.clipboard.writeText(url).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  }

  return (
    <button type="button" className={styles.copy} onClick={copy}>
      <span aria-live="polite">
        {state === 'copied'
          ? 'Enlace copiado'
          : state === 'failed'
            ? 'No se pudo copiar'
            : 'Enlace a esta entrada'}
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
