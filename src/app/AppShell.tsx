import { useMemo } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { countByType } from '@/content/content-queries';
import { TYPE_LABELS, TYPE_NAV_ORDER } from '@/content/type-labels';
import { useContent } from '@/content/use-content';
import { ContentIssuesBanner } from '@/features/content-issues/ContentIssuesBanner';
import { PaletteProvider, PaletteTrigger } from '@/features/palette/CommandPalette';
import { PinnedNav } from '@/features/pins/PinnedNav';
import styles from './AppShell.module.css';

const MAIN_ID = 'contenido';

export function AppShell() {
  return (
    <PaletteProvider>
      <div className={styles.shell}>
        <a className={styles.skipLink} href={`#${MAIN_ID}`}>
          Saltar al contenido
        </a>
        {import.meta.env.DEV && <ContentIssuesBanner />}
        <header className={styles.header}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandName}>Asgoria</span>
            <span className={styles.brandTagline}>Grimorio del DM</span>
          </Link>
          <PaletteTrigger />
        </header>
        <div className={styles.body}>
          <CategoryNav />
          <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </PaletteProvider>
  );
}

function CategoryNav() {
  const { entries } = useContent();
  const counts = useMemo(() => countByType(entries), [entries]);

  return (
    <nav aria-label="Categorías" className={styles.nav}>
      <span className={styles.navLabel}>Biblioteca</span>
      {TYPE_NAV_ORDER.map((type) => (
        <NavLink
          key={type}
          to={`/${type}`}
          // Explicit so every browser reads 'NPCs, 3 fichas' instead of 'NPCs 3'.
          aria-label={`${TYPE_LABELS[type].plural}, ${entryCount(counts[type])}`}
          className={({ isActive }) =>
            isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
          }
        >
          {TYPE_LABELS[type].plural}
          <span
            className={
              counts[type] === 0 ? `${styles.navCount} ${styles.navCountEmpty}` : styles.navCount
            }
          >
            {counts[type]}
          </span>
        </NavLink>
      ))}
      <PinnedNav />
    </nav>
  );
}

function entryCount(count: number): string {
  return count === 1 ? '1 ficha' : `${count} fichas`;
}
