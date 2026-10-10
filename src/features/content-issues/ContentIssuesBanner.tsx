import { useId, useState } from 'react';
import type { ContentIssue } from '@/content/types';
import { useContent } from '@/content/use-content';
import styles from './ContentIssuesBanner.module.css';

/** Dev-only notice listing invalid entries (left out of the app) and warnings. */
export function ContentIssuesBanner() {
  const { issues } = useContent();
  const [showErrors, setShowErrors] = useState(false);
  const errorListId = useId();

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  if (errors.length === 0 && warnings.length === 0) return null;

  const brokenFiles = new Set(errors.map((issue) => issue.path)).size;

  return (
    <section className={styles.panel} aria-label="Problemas en el contenido">
      {errors.length > 0 && (
        <div className={styles.errors}>
          <div className={styles.bar}>
            <p className={styles.errorTitle}>
              {brokenFiles === 1
                ? '1 ficha con errores no se muestra'
                : `${brokenFiles} fichas con errores no se muestran`}
            </p>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={showErrors}
              aria-controls={errorListId}
              onClick={() => setShowErrors((shown) => !shown)}
            >
              {showErrors ? 'Ocultar errores' : 'Ver errores'}
            </button>
          </div>
          <IssueList id={errorListId} issues={errors} hidden={!showErrors} />
        </div>
      )}
      {warnings.length > 0 && (
        <details className={styles.warnings}>
          <summary className={styles.summary}>
            {warnings.length === 1 ? '1 aviso' : `${warnings.length} avisos`} en el contenido
          </summary>
          <IssueList issues={warnings} />
        </details>
      )}
    </section>
  );
}

interface IssueListProps {
  id?: string;
  issues: ContentIssue[];
  hidden?: boolean;
}

function IssueList({ id, issues, hidden }: IssueListProps) {
  return (
    <ul id={id} className={styles.list} hidden={hidden}>
      {issues.map((issue, index) => (
        <li key={`${issue.path}-${index}`} className={styles.item}>
          <code className={styles.path}>{issue.path}</code>
          {issue.field && <span className={styles.field}>{issue.field}</span>}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
