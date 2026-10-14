import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from 'react-router';
import { listEntries } from '@/content/content-queries';
import { queryTerms } from '@/content/highlight';
import { isOficio, recipesOf, type OficioMeta } from '@/content/oficio';
import { oficioMetaOf } from '@/content/oficio-data';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useContent } from '@/content/use-content';
import { useEntryBody } from '@/content/use-entry-body';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { Highlighted } from '@/features/palette/Highlighted';
import { PinButton } from '@/features/pins/PinButton';
import { useRecents } from '@/features/pins/use-saved-items';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { Page } from '@/ui/Page';
import { MarkdownBody } from '../EntryBody';
import { editorUrl } from '../editor-link';
import pageStyles from '../EntryPage.module.css';
import { EntryTabs } from '../EntryTabs';
import { scrollAndFlash } from '../scroll-to';
import { filterRecipes } from './oficio-filter';
import { RecipeCard } from './RecipeCard';
import styles from './OficioView.module.css';

const DEBOUNCE_MS = 150;
const EMPTY_META: OficioMeta = { groups: [], materials: [], crafted: 0 };

/** The URL parameters of an oficio's view. */
type OficioParam = 'q' | 'grupo';

/** Every oficio, in the order of their tabs: alphabetically. */
function useOficios(): EntryMeta<'oficio'>[] {
  const { entries } = useContent();
  return useMemo(() => listEntries(entries, 'oficio').filter(isOficio), [entries]);
}

/** /oficio: opens the first oficio; with none yet, says how to add one. */
export function OficioIndex() {
  const [first] = useOficios();
  if (first) return <Navigate to={`/oficio/${first.slug}`} replace />;
  const { plural, plainPlural } = TYPE_LABELS.oficio;
  return (
    <Page title={plural} subtitle={`Aún no hay ${plainPlural}.`} documentTitle={plural}>
      <p className={styles.hint}>
        {'Crea uno copiando '}
        <code>/content/_templates/oficio.md</code>
        {' en '}
        <code>/content/oficio/</code>
      </p>
    </Page>
  );
}

/**
 * /oficio/:slug — one tab per oficio and the open one, the URL's, over the whole width: no list
 * column for this type.
 */
export function OficioPage() {
  const { slug = '' } = useParams();
  const oficios = useOficios();
  const navigate = useNavigate();
  const baseId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useFocusTitleOnArrival(titleRef);

  const entry = oficios.find((oficio) => oficio.slug === slug);
  if (!entry) return <NotFoundPage />;

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;
  return (
    <div className={`${pageStyles.page} ${styles.page}`}>
      <EntryTabs
        label={TYPE_LABELS.oficio.plural}
        tabs={oficios.map((oficio) => ({
          id: oficio.slug,
          label: oficio.data.title,
          count: recipesOf(oficioMetaOf(oficio.slug) ?? EMPTY_META).length,
          tabId: tabId(oficio.slug),
          panelId: panelId(oficio.slug),
        }))}
        selected={entry.slug}
        onSelect={(next) => {
          if (next !== entry.slug) navigate(`/oficio/${next}`, { replace: true });
        }}
      />
      <div
        role="tabpanel"
        id={panelId(entry.slug)}
        aria-labelledby={tabId(entry.slug)}
        className={styles.panel}
      >
        {/* A fresh view per oficio, so its search and open breakdowns don't carry over. */}
        <OficioView key={entry.slug} entry={entry} titleRef={titleRef} />
      </div>
    </div>
  );
}

/**
 * Arriving at the oficios, the focus goes to the title and the page scrolls to the top, as a full
 * page load would; moving between their tabs keeps the focus on the tabs. Back/forward (POP) and
 * a link to a recipe are left alone.
 */
function useFocusTitleOnArrival(titleRef: RefObject<HTMLHeadingElement | null>) {
  const navigationType = useNavigationType();
  const focusTitle = useEffectEvent(() => {
    if (navigationType === 'POP' || window.location.hash) return;
    window.scrollTo(0, 0);
    titleRef.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    focusTitle();
  }, []);
}

/** Puts the open oficio at the top of the recents. */
function useTrackRecent(slug: string) {
  const { add } = useRecents();
  const addRecent = useEffectEvent(add);
  useEffect(() => {
    addRecent({ type: 'oficio', slug });
  }, [slug]);
}

interface OficioViewProps {
  entry: EntryMeta<'oficio'>;
  /** The page title, which OficioPage focuses when the DM arrives. */
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * Header, search and group chips, the recipes by group as cards, and the base materials. All of
 * it comes from the metadata derived at build time; only the oficio's notes wait for its body.
 */
function OficioView({ entry, titleRef }: OficioViewProps) {
  useDocumentTitle(entry.data.title);
  useTrackRecent(entry.slug);
  const meta = oficioMetaOf(entry.slug) ?? EMPTY_META;
  const recipes = useMemo(() => recipesOf(meta), [meta]);
  const names = useMemo(() => new Map(recipes.map(({ id, nombre }) => [id, nombre])), [recipes]);
  const pathname = `/oficio/${entry.slug}`;
  const body = useEntryBody(entry.path);

  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const urlQuery = params.get('q') ?? '';
  const groupParam = params.get('grupo');
  const group = meta.groups.find(({ id }) => id === groupParam)?.id;

  function setParam(key: OficioParam, value: string | undefined) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  // The cards filter as the DM types; the URL follows 150 ms later.
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    // The URL changed from outside (back button, a link to a recipe): it wins over the box.
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  const commitQuery = useEffectEvent((value: string) => {
    setSyncedQuery(value.trim());
    setParam('q', value.trim());
  });
  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => commitQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, urlQuery]);

  function clearFilters() {
    setQuery('');
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('q');
        next.delete('grupo');
        return next;
      },
      { replace: true },
    );
  }

  const terms = useMemo(() => queryTerms(query), [query]);
  // The recipe a link points to (#r-…): a chip, "Se usa en", a search result.
  const anchor = decodeURIComponent(location.hash.slice(1));
  const target = names.has(anchor) ? anchor : undefined;
  const filtered = useMemo(
    () => filterRecipes(meta, { terms, group }, target),
    [meta, terms, group, target],
  );
  const shown = filtered.reduce((sum, { recipes: list }) => sum + list.length, 0);
  const filtering = terms.length > 0 || group !== undefined;

  // Scroll to that recipe and flash it, again on every link to it.
  useEffect(() => {
    const card = target ? document.getElementById(target) : null;
    return card ? scrollAndFlash(card, card.querySelector('h3')) : undefined;
  }, [target, location.key]);

  const baseId = useId();
  const searchId = `${baseId}-search`;
  const countId = `${baseId}-count`;
  const materialsId = `${baseId}-materials`;
  const { title, resumen } = entry.data;

  return (
    <>
      <div className={pageStyles.head}>
        <div className={pageStyles.titles}>
          <p className={pageStyles.kicker}>{TYPE_LABELS.oficio.singular}</p>
          <h1 ref={titleRef} tabIndex={-1} className={pageStyles.title}>
            {title}
          </h1>
          {resumen && <p className={pageStyles.subtitle}>{resumen}</p>}
          <p className={styles.stats}>
            {[
              plural(recipes.length, 'receta', 'recetas'),
              plural(meta.crafted, 'componente se fabrica', 'componentes se fabrican'),
              plural(meta.materials.length, 'material base', 'materiales base'),
            ].join(' · ')}
          </p>
        </div>
        <div className={pageStyles.actions}>
          <PinButton item={{ type: entry.type, slug: entry.slug }} />
          {import.meta.env.DEV && (
            <a
              className={pageStyles.secondaryButton}
              href={editorUrl(__REPO_ROOT__, entry.path)}
              title="Abrir esta ficha en VS Code"
            >
              Editar .md
            </a>
          )}
        </div>
      </div>

      {body?.trim() && <MarkdownBody markdown={body} />}

      <div className={styles.toolbar}>
        <div className={styles.search}>
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
          <label htmlFor={searchId} className="visually-hidden">
            {`Buscar en las recetas de ${title}`}
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder="Busca una receta o un componente…"
            autoComplete="off"
            aria-describedby={countId}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span id={countId} className={styles.count} aria-live="polite">
            {filtering ? `${shown} de ${plural(recipes.length, 'receta', 'recetas')}` : ''}
          </span>
        </div>
        {meta.groups.length > 1 && (
          <div className={styles.chips} role="group" aria-label="Filtrar por grupo">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={!group}
              onClick={() => setParam('grupo', undefined)}
            >
              Todos
            </button>
            {meta.groups.map(({ id, nombre, recipes: ofGroup }) => (
              <button
                key={id}
                type="button"
                className={styles.chip}
                aria-pressed={group === id}
                aria-label={`${nombre}, ${plural(ofGroup.length, 'receta', 'recetas')}`}
                onClick={() => setParam('grupo', group === id ? undefined : id)}
              >
                {nombre}
                <span className={styles.chipCount}>{ofGroup.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {recipes.length === 0 ? (
        <p className={styles.empty}>Este oficio todavía no tiene recetas.</p>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Ninguna receta coincide con la búsqueda.</p>
          <button type="button" className={styles.chip} onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        filtered.map(({ group: { id, nombre, recipes: ofGroup }, recipes: list }) => (
          <section key={id} className={styles.group} aria-labelledby={`${baseId}-${id}`}>
            <h2 id={`${baseId}-${id}`} className={styles.groupTitle}>
              {nombre}{' '}
              <span className={styles.groupCount}>
                {filtering
                  ? `· ${list.length} de ${ofGroup.length}`
                  : `· ${plural(ofGroup.length, 'receta', 'recetas')}`}
              </span>
            </h2>
            <ul className={styles.cards}>
              {list.map((recipe) => (
                <li key={recipe.id}>
                  <RecipeCard recipe={recipe} pathname={pathname} names={names} terms={terms} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {meta.materials.length > 0 && (
        <section id="materiales-base" className={styles.group} aria-labelledby={materialsId}>
          <h2 id={materialsId} className={styles.groupTitle}>
            Materiales base{' '}
            <span className={styles.groupCount}>{`· ${meta.materials.length}`}</span>
          </h2>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col">Recetas que lo usan</th>
                </tr>
              </thead>
              <tbody>
                {meta.materials.map(({ nombre, usedIn }) => (
                  <tr key={nombre}>
                    <th scope="row">
                      <Highlighted text={nombre} terms={terms} />
                    </th>
                    <td>
                      <ul className={styles.links}>
                        {usedIn.map((id) => (
                          <li key={id}>
                            <Link to={{ pathname, hash: id }}>{names.get(id) ?? id}</Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
