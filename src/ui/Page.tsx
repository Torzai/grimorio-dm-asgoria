import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/hooks/use-document-title';
import styles from './Page.module.css';

interface PageProps {
  title: string;
  /** Line under the title, in the mockup's italic lead style. */
  subtitle?: ReactNode;
  /** Title for the browser tab; omit to show only the app name. */
  documentTitle?: string;
  children?: ReactNode;
}

/** Content column with the mockup's page heading. */
export function Page({ title, subtitle, documentTitle, children }: PageProps) {
  useDocumentTitle(documentTitle);
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
