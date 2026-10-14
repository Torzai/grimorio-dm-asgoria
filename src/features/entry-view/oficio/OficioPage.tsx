import { useEffect, useEffectEvent, useId, useMemo, useRef, type RefObject } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from 'react-router';
import { listEntries } from '@/content/content-queries';
import {
  isOficio,
  oficioAnchorSearch,
  recipesOf,
  type OficioMeta,
  type OficioTab,
} from '@/content/oficio';
import { oficioMetaOf } from '@/content/oficio-data';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useContent } from '@/content/use-content';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { PinButton } from '@/features/pins/PinButton';
import { useRecents } from '@/features/pins/use-saved-items';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { Page } from '@/ui/Page';
import { editorUrl } from '../editor-link';
import pageStyles from '../EntryPage.module.css';
import { EntryTabs } from '../EntryTabs';
import { ComponentsTab } from './ComponentsTab';
import { CraftTab } from './CraftTab';
import { plural } from './master-detail';
import { TAB_BAR_STATE, tabOf, useSetParams } from './oficio-url';
import { RecipesTab } from './RecipesTab';
import { SkillsTab } from './SkillsTab';
import styles from './OficioView.module.css';

const EMPTY_META: OficioMeta = { groups: [], components: [], levels: [], skills: [] };

/** The parameter that selects something in each tab, when it has one. */
const SELECTION_PARAM: Partial<Record<OficioTab, string>> = {
  recetas: 'r',
  componentes: 'c',
  habilidades: 'h',
};

/** Every oficio, in the order of their tabs: alphabetically. */
function useOficios(): EntryMeta<'oficio'>[] {
  const { entries } = useContent();
  return useMemo(() => listEntries(entries, 'oficio').filter(isOficio), [entries]);
}

/** /oficio: opens the first oficio; with none yet, says how to add one. */
export function OficioIndex() {
  const [first] = useOficios();
  if (first) return <Navigate to={`/oficio/${first.slug}`} replace />;
  const { plural: title, plainPlural } = TYPE_LABELS.oficio;
  return (
    <Page title={title} subtitle={`Aún no hay ${plainPlural}.`} documentTitle={title}>
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
        {/* A fresh view per oficio, so its searches and focus don't carry over. */}
        <OficioView key={entry.slug} entry={entry} titleRef={titleRef} />
      </div>
    </div>
  );
}

/**
 * Arriving at the oficios, the page scrolls to the top and the focus goes to the title, as a full
 * page load would, or to what the URL opens (a recipe, a component), which takes it itself.
 * Moving between tabs keeps the focus on the tabs; back and forward (POP) are left alone.
 */
function useFocusTitleOnArrival(titleRef: RefObject<HTMLHeadingElement | null>) {
  const navigationType = useNavigationType();
  const focusTitle = useEffectEvent(() => {
    if (navigationType === 'POP' || window.location.hash) return;
    // What the URL opens has already taken the focus and scrolled to itself (child effects
    // run first).
    const params = new URLSearchParams(window.location.search);
    const selection = SELECTION_PARAM[tabOf(params)];
    if (selection && params.has(selection)) return;
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
 * Header and the four tools of an oficio, one per tab (?tab=): its recipes, the library of its
 * components, what can be made with an inventory, and its skills and rolls. All of it comes from
 * the metadata derived at build time; only the rolls and notes wait for the body.
 */
function OficioView({ entry, titleRef }: OficioViewProps) {
  useDocumentTitle(entry.data.title);
  useTrackRecent(entry.slug);
  const meta = oficioMetaOf(entry.slug) ?? EMPTY_META;
  const recipes = useMemo(() => recipesOf(meta), [meta]);
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabOf(params);

  // A link with an anchor (#r-…, #c-…, #h-…: an old link, a [[slug#anchor]] wikilink) opens its
  // tab with that part selected.
  useEffect(() => {
    const search = oficioAnchorSearch(decodeURIComponent(location.hash.slice(1)));
    if (search) navigate({ pathname: location.pathname, search }, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const baseId = useId();
  const tabId = (id: OficioTab) => `${baseId}-tab-${id}`;
  const panelId = (id: OficioTab) => `${baseId}-panel-${id}`;
  const crafted = meta.components.filter((component) => component.producers.length > 0).length;
  const { title, resumen, fuente } = entry.data;
  const tabs: { id: OficioTab; label: string; count?: number }[] = [
    { id: 'recetas', label: 'Recetas', count: recipes.length },
    { id: 'componentes', label: 'Componentes', count: meta.components.length },
    { id: 'fabricar', label: '¿Qué puedo fabricar?' },
    { id: 'habilidades', label: 'Habilidades y tiradas', count: meta.skills.length || undefined },
  ];

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
              `${plural(meta.components.length, 'componente', 'componentes')} (${meta.components.length - crafted} base, ${crafted} ${crafted === 1 ? 'fabricable' : 'fabricables'})`,
              meta.skills.length > 0 ? plural(meta.skills.length, 'habilidad', 'habilidades') : '',
              fuente ? `Fuente: ${fuente}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
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

      <div className={styles.tools}>
        {/* On a phone the four tabs don't fit: they scroll sideways, not the page. */}
        <div className={styles.tabsScroll}>
          <EntryTabs
            label={`Secciones de ${title}`}
            tabs={tabs.map((item) => ({
              ...item,
              tabId: tabId(item.id),
              panelId: panelId(item.id),
            }))}
            selected={tab}
            onSelect={(next) => {
              // Marked, so what the tab has open doesn't take the focus from the tabs.
              if (next !== tab) setParams({ tab: next }, TAB_BAR_STATE);
            }}
          />
        </div>
        <div
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          className={styles.tabPanel}
        >
          {tab === 'recetas' && <RecipesTab meta={meta} />}
          {tab === 'componentes' && <ComponentsTab meta={meta} />}
          {tab === 'fabricar' && <CraftTab slug={entry.slug} meta={meta} />}
          {tab === 'habilidades' && <SkillsTab entry={entry} meta={meta} />}
        </div>
      </div>
    </>
  );
}
