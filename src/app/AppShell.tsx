import { useMemo, type FormEvent } from 'react';
import { Link, NavLink, Outlet, createSearchParams, useNavigate } from 'react-router';
import { countByType } from '@/content/content-queries';
import { TYPE_LABELS, TYPE_NAV_ORDER } from '@/content/type-labels';
import { useContent } from '@/content/use-content';
import { ContentIssuesBanner } from '@/features/content-issues/ContentIssuesBanner';
import styles from './AppShell.module.css';

const MAIN_ID = 'contenido';

export function AppShell() {
  return (
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
        <SearchForm />
      </header>
      <div className={styles.body}>
        <CategoryNav />
        <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SearchForm() {
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('q');
    const q = typeof query === 'string' ? query.trim() : '';
    navigate({ pathname: '/buscar', search: `?${createSearchParams({ q })}` });
  }

  return (
    <form role="search" className={styles.search} onSubmit={handleSubmit}>
      <svg
        className={styles.searchIcon}
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <label htmlFor="busqueda" className="visually-hidden">
        Buscar en el grimorio
      </label>
      <input
        id="busqueda"
        name="q"
        type="search"
        className={styles.searchInput}
        placeholder="Busca un NPC, comando, varita, zona…"
        autoComplete="off"
      />
      {/* Visual hint only until the palette exists (T08). */}
      <kbd className={styles.shortcut} aria-hidden="true">
        Ctrl K
      </kbd>
    </form>
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
          <span className={styles.navCount}>{counts[type]}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function entryCount(count: number): string {
  return count === 1 ? '1 ficha' : `${count} fichas`;
}
