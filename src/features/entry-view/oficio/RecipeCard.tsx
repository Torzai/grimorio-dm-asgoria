import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { Recipe, RecipeComponent } from '@/content/oficio';
import { Highlighted } from '@/features/palette/Highlighted';
import styles from './OficioView.module.css';

interface RecipeCardProps {
  recipe: Recipe;
  /** '/oficio/<slug>': the cards link to each other's anchors under it. */
  pathname: string;
  /** The name of each recipe of the oficio, by anchor, for "Se usa en". */
  names: ReadonlyMap<string, string>;
  /** Normalized words of the oficio's search, highlighted in the names. */
  terms: readonly string[];
}

/**
 * A recipe under its anchor: its components (a crafted one links to its recipe), the recipes
 * that ask for it and, unfolded on demand, every base material it takes in all.
 */
export function RecipeCard({ recipe, pathname, names, terms }: RecipeCardProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const totalsId = useId();
  // With only base materials, the breakdown would repeat the components.
  const hasCrafted = recipe.componentes.some((componente) => componente.recipe);

  return (
    <article id={recipe.id} className={styles.card} aria-labelledby={headingId}>
      <h3 id={headingId} tabIndex={-1} className={styles.cardTitle}>
        <Highlighted text={recipe.nombre} terms={terms} />
      </h3>

      <ul className={styles.components} aria-label="Componentes">
        {recipe.componentes.map((componente, index) => (
          <li key={index}>
            <ComponentChip componente={componente} pathname={pathname} terms={terms} />
          </li>
        ))}
      </ul>

      {recipe.notas && <p className={styles.notes}>{recipe.notas}</p>}

      {recipe.usedIn.length > 0 && (
        <div className={styles.usedIn}>
          <span className={styles.label}>Se usa en</span>
          <ul className={styles.links}>
            {recipe.usedIn.map((id) => (
              <li key={id}>
                <Link to={{ pathname, hash: id }}>{names.get(id) ?? id}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasCrafted && (
        <div className={styles.totals}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={totalsId}
            onClick={() => setOpen(!open)}
          >
            <svg
              className={styles.chevron}
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            {open ? 'Ocultar materiales totales' : 'Ver materiales totales'}
          </button>
          <div id={totalsId} className={styles.totalsBody} hidden={!open}>
            <ul className={styles.components} aria-label="Materiales base en total">
              {recipe.totals.map(({ nombre, cantidad }, index) => (
                <li key={index} className={styles.component}>
                  <Quantity nombre={nombre} cantidad={cantidad} terms={terms} />
                </li>
              ))}
            </ul>
            {recipe.cyclic && (
              <p className={styles.cyclic}>
                Desglose incompleto: alguna receta acaba pidiéndose a sí misma.
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

interface ComponentChipProps {
  componente: RecipeComponent;
  pathname: string;
  terms: readonly string[];
}

/** 'Nombre ×N'; a component crafted in the oficio is a link to its recipe, with a hammer. */
function ComponentChip({ componente, pathname, terms }: ComponentChipProps) {
  const { nombre, cantidad, recipe } = componente;
  if (!recipe) {
    return (
      <span className={styles.component}>
        <Quantity nombre={nombre} cantidad={cantidad} terms={terms} />
      </span>
    );
  }
  return (
    <Link
      className={`${styles.component} ${styles.crafted}`}
      to={{ pathname, hash: recipe }}
      title="Se fabrica: ver su receta"
    >
      <HammerIcon />
      <Quantity nombre={nombre} cantidad={cantidad} terms={terms} />
      <span className="visually-hidden"> (se fabrica: ver su receta)</span>
    </Link>
  );
}

function Quantity({
  nombre,
  cantidad,
  terms,
}: {
  nombre: string;
  cantidad: number;
  terms: readonly string[];
}) {
  return (
    <span>
      <Highlighted text={nombre} terms={terms} />
      {/* A no-break space keeps the quantity with its name. */}
      <span className={styles.quantity}>&nbsp;×{cantidad}</span>
    </span>
  );
}

function HammerIcon() {
  return (
    <svg
      className={styles.craftIcon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 12l-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9" />
      <path d="M17.6 15L22 10.6" />
      <path d="M20.9 11.7l-1.3-1.3a2 2 0 0 1-.6-1.4V7.8l-2.3-2.3A6 6 0 0 0 12.5 3.8H9.6l.9.8a6.2 6.2 0 0 1 2.1 4.6V10l2 2h1.2a2 2 0 0 1 1.4.6l1.3 1.3" />
    </svg>
  );
}
