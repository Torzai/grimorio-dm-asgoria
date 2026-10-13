import { useId, useState } from 'react';
import { Link, type To } from 'react-router';
import type { NameCount } from '@/content/historial-items';
import { AsideBox } from '../EntryAside';
import styles from './NameCountList.module.css';

const TOP_NARRATORS = 5;

export interface CountLink {
  to: To;
  title?: string;
}

interface NameCountListProps<T extends NameCount> {
  id?: string;
  items: readonly T[];
  linkFor?: (item: T) => CountLink | undefined;
}

/** Names with a count at their right, each one a link when `linkFor` gives one. */
export function NameCountList<T extends NameCount>({ id, items, linkFor }: NameCountListProps<T>) {
  return (
    <ul id={id} className={styles.counts}>
      {items.map((item) => {
        const link = linkFor?.(item);
        return (
          <li key={item.name} className={styles.countRow}>
            {link ? (
              <Link className={styles.countLink} to={link.to} title={link.title}>
                {item.name}
              </Link>
            ) : (
              <span>{item.name}</span>
            )}
            <span className={styles.countValue}>{item.count}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Narrado por": the first 5 narrators, and a button for the rest. */
export function NarratorsBox({ narrators }: { narrators: readonly NameCount[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? narrators : narrators.slice(0, TOP_NARRATORS);
  const listId = useId();

  return (
    <AsideBox title="Narrado por">
      <NameCountList id={listId} items={shown} />
      {narrators.length > TOP_NARRATORS && (
        <button
          type="button"
          className={styles.showAll}
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? `Ver solo ${TOP_NARRATORS}` : `Ver los ${narrators.length}`}{' '}
          <span aria-hidden="true">{showAll ? '↑' : '→'}</span>
        </button>
      )}
    </AsideBox>
  );
}
