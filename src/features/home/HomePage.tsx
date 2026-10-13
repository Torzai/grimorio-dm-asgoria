import { useId, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { countByType, listEntries } from '@/content/content-queries';
import { cronicasByUpdate } from '@/content/cronica-data';
import { recentActivePjs } from '@/content/pj-data';
import { PJ_ESTADO_LABELS, TYPE_LABELS, TYPE_NAV_ORDER } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useContent } from '@/content/use-content';
import { formatDate, formatNumericDate } from '@/features/entry-list/entry-meta';
import { PaletteTrigger } from '@/features/palette/CommandPalette';
import type { ResolvedItem } from '@/features/pins/saved-items';
import { usePins, useRecents } from '@/features/pins/use-saved-items';
import { useDocumentTitle } from '@/hooks/use-document-title';
import styles from './HomePage.module.css';

const ACTIVE_PJS = 8;
const LATEST_SESSIONS = 3;

/** /: the search, what the DM keeps at hand, and a way into each part of the grimoire. */
export function HomePage() {
  useDocumentTitle();
  const { entries } = useContent();
  const { pins } = usePins();
  const { recents } = useRecents();
  const activePjs = useMemo(() => recentActivePjs(entries, ACTIVE_PJS), [entries]);
  const sessions = useMemo(
    () => listEntries(entries, 'sesion').slice(0, LATEST_SESSIONS),
    [entries],
  );
  const counts = useMemo(() => countByType(entries), [entries]);
  const cronicas = useMemo(() => cronicasByUpdate(entries), [entries]);

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <p className={styles.kicker}>Grimorio del DM</p>
        <h1 className={styles.title}>Bienvenido a Asgoria</h1>
        <p className={styles.subtitle}>
          Busca cualquier ficha desde aquí, o con Ctrl+K o / desde cualquier pantalla.
        </p>
      </div>

      <PaletteTrigger large />

      <div className={styles.grid}>
        <Box title="Fijados">
          <SavedList items={pins} empty="Fija fichas con el botón Fijar o Ctrl+Enter." />
        </Box>

        <Box title="Recientes">
          <SavedList items={recents} empty="Las fichas que abras aparecerán aquí." />
        </Box>

        <Box title="PJ activos recientes">
          {activePjs.length === 0 ? (
            <p className={styles.empty}>Ningún PJ activo tiene historial todavía.</p>
          ) : (
            <ul className={styles.list}>
              {activePjs.map(({ entry, last }) => (
                <li key={entry.slug}>
                  <Link className={styles.row} to={`/pj/${entry.slug}`}>
                    <span className={styles.rowTitle}>
                      <span
                        className={styles.dot}
                        data-estado={entry.data.estado}
                        aria-hidden="true"
                      />
                      {entry.data.title}
                    </span>
                    <span className={styles.rowMeta}>
                      {`${PJ_ESTADO_LABELS[entry.data.estado]} · ${formatNumericDate(last)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box title="Crónicas">
          {cronicas.length === 0 ? (
            <p className={styles.empty}>Todavía no hay crónicas.</p>
          ) : (
            <ul className={styles.list}>
              {cronicas.map(({ entry, updated }) => (
                <li key={entry.slug}>
                  <Link className={styles.row} to={`/cronica/${entry.slug}`}>
                    <span className={styles.rowTitle}>{entry.data.title}</span>
                    <span className={styles.rowMeta}>
                      {updated ? formatNumericDate(updated) : 'Sin fecha'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box title="Últimas sesiones">
          {sessions.length === 0 ? (
            <p className={styles.empty}>Todavía no hay sesiones en el diario.</p>
          ) : (
            <ul className={styles.list}>
              {sessions.map((session) => (
                <li key={session.slug}>
                  <Link className={styles.row} to={`/sesion/${session.slug}`}>
                    <span className={styles.rowTitle}>{session.data.title}</span>
                    <span className={styles.rowMeta}>{sessionDate(session)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box title="Biblioteca">
          <ul className={styles.list}>
            {TYPE_NAV_ORDER.map((type) => (
              <li key={type}>
                <Link className={styles.row} to={`/${type}`}>
                  <span className={styles.rowTitle}>{TYPE_LABELS[type].plural}</span>
                  <span className={styles.count}>{counts[type]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      </div>
    </div>
  );
}

function sessionDate(session: EntryMeta): string {
  return session.data.type === 'sesion' ? formatDate(session.data.fecha) : '';
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.box} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.boxTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SavedList({ items, empty }: { items: readonly ResolvedItem[]; empty: string }) {
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key}>
          <Link className={styles.row} to={item.to}>
            <span className={styles.rowTitle}>{item.title}</span>
            <span className={styles.tag}>{item.tag}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
