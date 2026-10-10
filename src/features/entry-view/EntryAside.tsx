import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { EntryContext } from '@/content/content-queries';
import { TYPE_LABELS } from '@/content/type-labels';
import type { Entry } from '@/content/types';
import { formatDate } from '@/features/entry-list/entry-meta';
import styles from './EntryAside.module.css';

const entryPath = (entry: Entry) => `/${entry.type}/${entry.slug}`;

interface EntryAsideProps {
  context: EntryContext;
}

/** Side boxes of an entry; each one only when it has something to show. */
export function EntryAside({ context }: EntryAsideProps) {
  const { related, mentionedIn, sessions, inZone } = context;
  if (related.length + mentionedIn.length + sessions.length + inZone.length === 0) return null;

  return (
    <aside className={styles.aside} aria-label="Fichas relacionadas">
      {related.length > 0 && (
        <Box title="Relacionado">
          <TypedList entries={related} />
        </Box>
      )}
      {mentionedIn.length > 0 && (
        <Box title="Mencionado en">
          <TypedList entries={mentionedIn} />
        </Box>
      )}
      {sessions.length > 0 && (
        <Box title="Diario de sesiones">
          <SessionList sessions={sessions} />
        </Box>
      )}
      {inZone.length > 0 && (
        <Box title="En esta zona">
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
        </Box>
      )}
    </aside>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
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
function TypedList({ entries }: { entries: readonly Entry[] }) {
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

/** '14 mar 2026 · Title', the date in the muted style of the mockup. */
function SessionList({ sessions }: { sessions: readonly Entry[] }) {
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
