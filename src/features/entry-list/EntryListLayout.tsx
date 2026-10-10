import { Link, Outlet, useLocation, useParams } from 'react-router';
import { isEntryType } from '@/content/content-queries';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryType } from '@/content/types';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { EntryListColumn } from './EntryListColumn';
import styles from './EntryListLayout.module.css';

/**
 * Master-detail for /:type: the list of the type next to whatever the child route renders
 * (the "pick an entry" hint or the entry). Below 1100px only one of the two is shown.
 */
export function EntryListLayout() {
  const { type, slug } = useParams();
  if (!isEntryType(type)) return <NotFoundPage />;

  const hasEntry = slug !== undefined;
  return (
    <div className={styles.layout}>
      <div className={hasEntry ? `${styles.list} ${styles.narrowHidden}` : styles.list}>
        <EntryListColumn type={type} activeSlug={slug} />
      </div>
      <div className={hasEntry ? styles.detail : `${styles.detail} ${styles.narrowHidden}`}>
        {hasEntry && <BackToList type={type} />}
        <Outlet />
      </div>
    </div>
  );
}

/** Only shown on narrow screens, where the list is hidden while an entry is open. */
function BackToList({ type }: { type: EntryType }) {
  // Keeps the active filters, so going back lands on the list the DM came from.
  const { search } = useLocation();
  return (
    <Link className={styles.back} to={{ pathname: `/${type}`, search }}>
      <span aria-hidden="true">←</span> Volver a {TYPE_LABELS[type].plural}
    </Link>
  );
}
