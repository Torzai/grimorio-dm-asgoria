import { useParams } from 'react-router';
import { countByType, isEntryType } from '@/content/content-queries';
import { TYPE_LABELS } from '@/content/type-labels';
import { useContent } from '@/content/use-content';
import { useDocumentTitle } from '@/hooks/use-document-title';
import styles from './EntryListEmpty.module.css';

/** Detail pane of /:type while no entry is open. */
export function EntryListEmpty() {
  const { type } = useParams();
  const { entries } = useContent();
  const knownType = isEntryType(type) ? type : undefined;
  useDocumentTitle(knownType && TYPE_LABELS[knownType].plural);
  if (!knownType) return null;

  const count = countByType(entries)[knownType];
  return (
    <div className={styles.empty}>
      <p className={styles.title}>Elige una ficha de la lista</p>
      <p className={styles.lead}>
        {`${TYPE_LABELS[knownType].plural} · ${count === 1 ? '1 ficha' : `${count} fichas`}`}
      </p>
    </div>
  );
}
