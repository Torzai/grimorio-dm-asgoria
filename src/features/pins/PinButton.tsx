import type { SavedItem } from './saved-items';
import { usePins } from './use-saved-items';
import styles from './PinButton.module.css';

/** The mockup's filled "Fijar" button of an entry's header; "Fijado" while pinned. */
export function PinButton({ item }: { item: SavedItem }) {
  const { isPinned, toggle } = usePins();
  const pinned = isPinned(item);
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={pinned}
      onClick={() => toggle(item)}
    >
      <StarIcon className={styles.icon} filled={pinned} />
      {pinned ? 'Fijado' : 'Fijar'}
    </button>
  );
}

/** A small icon button, for the header of an open history entry. */
export function PinIconButton({ item }: { item: SavedItem }) {
  const { isPinned, toggle } = usePins();
  const pinned = isPinned(item);
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label="Fijar esta entrada"
      aria-pressed={pinned}
      title={pinned ? 'Quitar de fijados' : 'Fijar esta entrada'}
      onClick={() => toggle(item)}
    >
      <StarIcon className={styles.icon} filled={pinned} />
    </button>
  );
}

/** The mockup's "Favoritos" star. */
export function StarIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  );
}
