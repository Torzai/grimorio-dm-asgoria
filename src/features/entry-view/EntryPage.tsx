import { useEffect, useEffectEvent, useMemo, useRef, type RefObject } from 'react';
import { Link, createSearchParams, useNavigationType, useParams } from 'react-router';
import { getEntry, getEntryContext, isEntryType } from '@/content/content-queries';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useContent } from '@/content/use-content';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { EntryAside } from './EntryAside';
import { EntryBody } from './EntryBody';
import { editorUrl } from './editor-link';
import { PjView } from './pj/PjView';
import styles from './EntryPage.module.css';

/** /:type/:slug, the detail pane next to the list. */
export function EntryPage() {
  const { type, slug = '' } = useParams();
  const { entries } = useContent();
  const entry = isEntryType(type) ? getEntry(entries, type, slug) : undefined;
  if (!entry) return <NotFoundPage />;
  return <EntryView entry={entry} />;
}

function EntryView({ entry }: { entry: EntryMeta }) {
  const content = useContent();
  const context = useMemo(() => getEntryContext(entry, content), [entry, content]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useDocumentTitle(entry.data.title);
  useFocusTitleOnChange(entry, titleRef);

  if (entry.data.type === 'pj') {
    return (
      <PjView
        // A fresh view per PJ, so the history's search and open entries don't carry over.
        key={entry.slug}
        entry={entry as EntryMeta<'pj'>}
        context={context}
        title={
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            {entry.data.title}
          </h1>
        }
      />
    );
  }

  const { aliases = [], tags = [], resumen } = entry.data;
  const subtitle = aliases.length > 0 ? `También conocido como: ${aliases.join(' · ')}` : resumen;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titles}>
          <p className={styles.kicker}>
            {TYPE_LABELS[entry.type].singular}
            {context.zona && (
              <>
                {' · '}
                <Link className={styles.kickerLink} to={`/zona/${context.zona.slug}`}>
                  {context.zona.data.title}
                </Link>
              </>
            )}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            {entry.data.title}
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {/* The "Fijar" button goes before this one in T09. */}
        {import.meta.env.DEV && (
          <div className={styles.actions}>
            <a
              className={styles.secondaryButton}
              href={editorUrl(__REPO_ROOT__, entry.path)}
              title="Abrir esta ficha en VS Code"
            >
              Editar .md
            </a>
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <ul className={styles.tags} aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag}>
              <Link
                className={styles.tag}
                to={{ pathname: `/${entry.type}`, search: `?${createSearchParams({ tag })}` }}
              >
                {`#${tag}`}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* The key data grid of each type goes here in T07. */}
      <div className={styles.columns}>
        <article className={styles.article}>
          <EntryBody entry={entry} />
        </article>
        <EntryAside context={context} />
      </div>
    </div>
  );
}

/**
 * When the DM moves to another entry, the focus goes to its title and the page scrolls to the
 * top, as a full page load would. The first load and back/forward (POP) are left to the browser.
 */
function useFocusTitleOnChange(entry: EntryMeta, titleRef: RefObject<HTMLHeadingElement | null>) {
  const navigationType = useNavigationType();
  const focusTitle = useEffectEvent(() => {
    // A link to a part of the page (#h-… in a PJ's history) scrolls there instead.
    if (navigationType === 'POP' || window.location.hash) return;
    window.scrollTo(0, 0);
    titleRef.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    focusTitle();
  }, [entry.type, entry.slug]);
}
