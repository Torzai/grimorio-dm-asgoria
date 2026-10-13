import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { EntryContext } from '@/content/content-queries';
import { cronicaMetaOf } from '@/content/cronica-data';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { formatDate, formatNumericDate } from '@/features/entry-list/entry-meta';
import styles from './EntryAside.module.css';

const entryPath = (entry: EntryMeta) => `/${entry.type}/${entry.slug}`;

interface EntryAsideProps {
  context: EntryContext;
  /** Boxes of a specific type that go before the common ones (e.g. a PJ's narrators). */
  before?: ReactNode;
}

/** Side boxes of an entry; each one only when it has something to show. */
export function EntryAside({ context, before }: EntryAsideProps) {
  const { related, mentionedIn, sessions, inZone, cronicas } = context;
  const count =
    related.length + mentionedIn.length + sessions.length + inZone.length + cronicas.length;
  if (count === 0 && !before) return null;

  return (
    <aside className={styles.aside} aria-label="Fichas relacionadas">
      {before}
      {cronicas.length > 0 && (
        <AsideBox title="Situación de esta zona">
          <CronicaList cronicas={cronicas} />
        </AsideBox>
      )}
      {related.length > 0 && (
        <AsideBox title="Relacionado">
          <TypedList entries={related} />
        </AsideBox>
      )}
      {mentionedIn.length > 0 && (
        <AsideBox title="Mencionado en">
          <TypedList entries={mentionedIn} />
        </AsideBox>
      )}
      {sessions.length > 0 && (
        <AsideBox title="Diario de sesiones">
          <SessionList sessions={sessions} />
        </AsideBox>
      )}
      {inZone.length > 0 && (
        <AsideBox title="En esta zona">
          {inZone.map(({ type, entries }) => (
            <div key={type} className={styles.group}>
              <h3 className={styles.groupTitle}>{TYPE_LABELS[type].plural}</h3>
              {type === 'sesion' ? (
                <SessionList sessions={entries} />
              ) : (
                <ul className={styles.list}>
                  {entries.map((entry) => (
                    <li key={entry.slug}>
                      <Link className={styles.link} to={entryPath(entry)}>
                        {entry.data.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </AsideBox>
      )}
    </aside>
  );
}

export function AsideBox({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.box} role="group" aria-labelledby={id}>
      <h2 id={id} className={styles.boxTitle}>
        {title}
      </h2>
      {children}
    </div>
  );
}

/** Links like '→ NPC: Tobías', as in the mockup. */
function TypedList({ entries }: { entries: readonly EntryMeta[] }) {
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <li key={entry.slug}>
          <Link className={styles.link} to={entryPath(entry)}>
            <span aria-hidden="true">→ </span>
            {`${TYPE_LABELS[entry.type].singular}: ${entry.data.title}`}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Each crónica with the day of its last update, as the sessions' dates. */
function CronicaList({ cronicas }: { cronicas: readonly EntryMeta[] }) {
  return (
    <ul className={styles.list}>
      {cronicas.map((entry) => {
        const updated = cronicaMetaOf(entry.slug)?.updated;
        return (
          <li key={entry.slug} className={styles.session}>
            <Link className={styles.link} to={entryPath(entry)}>
              {entry.data.title}
            </Link>
            {updated && (
              <>
                {' · '}
                <time className={styles.date} dateTime={updated}>
                  {`actualizada ${formatNumericDate(updated)}`}
                </time>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** '14 mar 2026 · Title', the date in the muted style of the mockup. */
function SessionList({ sessions }: { sessions: readonly EntryMeta[] }) {
  return (
    <ul className={styles.list}>
      {sessions.map((entry) => (
        <li key={entry.slug} className={styles.session}>
          {entry.data.type === 'sesion' && (
            <>
              <time className={styles.date} dateTime={entry.data.fecha}>
                {formatDate(entry.data.fecha)}
              </time>
              {' · '}
            </>
          )}
          <Link className={styles.link} to={entryPath(entry)}>
            {entry.data.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
