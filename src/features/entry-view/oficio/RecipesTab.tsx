import { useId, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { queryTerms } from '@/content/highlight';
import {
  indexOficio,
  recipesOf,
  type OficioIndex,
  type OficioMeta,
  type Recipe,
} from '@/content/oficio';
import { Highlighted } from '@/features/palette/Highlighted';
import { filterRecipes } from './oficio-filter';
import {
  componentParams,
  recipeParams,
  useParamLink,
  useQueryParam,
  useSetParams,
} from './oficio-url';
import {
  ChipGroup,
  ComponentChip,
  DetailEmpty,
  DetailSection,
  ListSection,
  MasterDetail,
  SearchBox,
} from './OficioParts';
import { handleRowKeys, levelAndDc, plural, useDetailFocus, useRevealRow } from './master-detail';
import styles from './OficioView.module.css';

/** Recetas: the recipes by group, filtered (?q=&grupo=&nivel=), and the open one (?r=). */
export function RecipesTab({ meta }: { meta: OficioMeta }) {
  const index = indexOficio(meta);
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const link = useParamLink();
  const [query, setQuery] = useQueryParam('q');

  const selected = index.recipes.get(params.get('r') ?? '');
  const groupParam = params.get('grupo') ?? '';
  const group = index.groups.has(groupParam) ? groupParam : undefined;
  const levelParam = Number(params.get('nivel'));
  const level = meta.levels.includes(levelParam) ? levelParam : undefined;

  const selectedId = selected?.id;
  const terms = useMemo(() => queryTerms(query), [query]);
  // A few dozen recipes: filtered on every render, no memo needed.
  const filtered = filterRecipes(meta, { terms, group, level }, selectedId);
  const total = recipesOf(meta).length;
  const visible = filtered.flatMap(({ recipes }) => recipes);
  const filtering = terms.length > 0 || group !== undefined || level !== undefined;
  // The list's single tab stop: the open recipe, or the first one shown.
  const focusId = selected && visible.includes(selected) ? selected.id : visible[0]?.id;

  const listRef = useRef<HTMLDivElement>(null);
  useRevealRow(listRef, selectedId);

  function clearFilters() {
    setQuery('');
    setParams({ q: undefined, grupo: undefined, nivel: undefined });
  }

  const master = (
    <>
      <div className={styles.filters}>
        <SearchBox
          label="Buscar recetas"
          value={query}
          placeholder="Receta o componente…"
          status={filtering ? `${visible.length} de ${total}` : ''}
          onChange={setQuery}
        />
        {meta.groups.length > 1 && (
          <ChipGroup
            label="Grupo"
            options={meta.groups.map(({ id, nombre, recipes }) => ({
              value: id,
              label: nombre,
              count: recipes.length,
            }))}
            selected={group}
            onSelect={(value) => setParams({ grupo: value })}
          />
        )}
        {meta.levels.length > 1 && (
          <ChipGroup
            label="Nivel"
            options={meta.levels.map((value) => ({ value: String(value), label: String(value) }))}
            selected={level === undefined ? undefined : String(level)}
            onSelect={(value) => setParams({ nivel: value })}
          />
        )}
        {filtering && (
          <button type="button" className={styles.clear} onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>
      <div ref={listRef} className={styles.list} onKeyDown={handleRowKeys}>
        <h2 className="visually-hidden">Lista de recetas</h2>
        {total === 0 ? (
          <p className={styles.empty}>Este oficio todavía no tiene recetas.</p>
        ) : visible.length === 0 ? (
          <p className={styles.empty}>Ninguna receta coincide con los filtros.</p>
        ) : (
          filtered.map(({ group: { id, nombre, recipes: all }, recipes }) => (
            <ListSection
              key={id}
              title={nombre}
              count={filtering ? `${recipes.length} de ${all.length}` : String(all.length)}
            >
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  <Link
                    data-row=""
                    className={styles.row}
                    to={link(recipeParams(recipe.id))}
                    aria-current={recipe.id === selectedId ? 'page' : undefined}
                    tabIndex={recipe.id === focusId ? 0 : -1}
                    data-unavailable={recipe.disponible ? undefined : ''}
                  >
                    <span className={styles.rowTitle}>
                      <Highlighted text={recipe.nombre} terms={terms} />
                      {recipe.produce > 1 && (
                        <span className={styles.rowUnits}>{`×${recipe.produce}`}</span>
                      )}
                    </span>
                    <span className={styles.rowMeta}>
                      {[levelAndDc(recipe), recipe.disponible ? '' : 'No disponible']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ListSection>
          ))
        )}
      </div>
    </>
  );

  return (
    <MasterDetail
      selected={selected !== undefined}
      master={master}
      detail={
        selected ? (
          <RecipeDetail recipe={selected} index={index} />
        ) : (
          <DetailEmpty
            title="Elige una receta de la lista"
            lead={`${plural(total, 'receta', 'recetas')} · sus componentes, lo que piden en materiales base y dónde se usan`}
          />
        )
      }
      back={{ to: link({ r: undefined }), label: 'Volver a las recetas' }}
    />
  );
}

interface RecipeDetailProps {
  recipe: Recipe;
  index: OficioIndex;
}

/**
 * A recipe: its components (each a link to the library), what one fabrication takes in base
 * materials with what is made on the way and left over, and the recipes that ask for it.
 */
function RecipeDetail({ recipe, index }: RecipeDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useDetailFocus(recipe.id, headingRef);
  const link = useParamLink();

  const nameOf = (id: string) => index.recipes.get(id)?.nombre ?? id;
  const usedIn = index.components.get(recipe.producto.key)?.usedIn ?? [];
  const { base, steps, alternatives, cyclic } = recipe.totals;
  const hasCrafted = recipe.componentes.some((componente) => componente.crafted);
  const leftovers = steps.flatMap(({ recipe: id, sobrante }) => {
    const producto = index.recipes.get(id)?.producto;
    return producto && sobrante > 0 ? [{ ...producto, cantidad: sobrante }] : [];
  });
  const facts = [
    levelAndDc(recipe),
    recipe.produce > 1 || recipe.producto.nombre !== recipe.nombre
      ? `Produce ${recipe.produce} × ${recipe.producto.nombre}`
      : '',
  ].filter(Boolean);

  return (
    <article className={styles.detailCard} aria-labelledby={headingId}>
      <header className={styles.detailHead}>
        <p className={styles.detailKicker}>{index.groups.get(recipe.group)?.nombre ?? 'Receta'}</p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.detailTitle}>
          {recipe.nombre}
        </h2>
        {(facts.length > 0 || !recipe.disponible) && (
          <p className={styles.detailMeta}>
            {facts.join(' · ')}
            {!recipe.disponible && <span className={styles.badge}>No disponible</span>}
          </p>
        )}
      </header>

      <DetailSection title="Componentes">
        <ul className={styles.components}>
          {recipe.componentes.map(({ key, nombre, cantidad, cargado, crafted }, position) => (
            <li key={`${key}-${position}`}>
              <ComponentChip
                nombre={nombre}
                cantidad={cantidad}
                cargado={cargado}
                crafted={crafted}
                to={link(componentParams(key))}
              />
            </li>
          ))}
        </ul>
      </DetailSection>

      {hasCrafted && (
        <DetailSection
          title="Total de materiales base"
          note={`Para una fabricación${recipe.produce > 1 ? ` (${recipe.produce} unidades)` : ''}, fabricando antes lo intermedio.`}
        >
          <ul className={styles.components}>
            {base.map(({ key, nombre, cantidad }) => (
              <li key={key}>
                <ComponentChip
                  nombre={nombre}
                  cantidad={cantidad}
                  to={link(componentParams(key))}
                />
              </li>
            ))}
          </ul>
          {steps.length > 0 && (
            <div className={styles.subsection}>
              <h4 className={styles.subTitle}>Fabricaciones</h4>
              <ol className={styles.steps}>
                {steps.map(({ recipe: id, veces }) => {
                  const step = index.recipes.get(id);
                  return (
                    <li key={id}>
                      <Link to={link(recipeParams(id))}>{nameOf(id)}</Link>
                      <span className={styles.quantity}>{` ×${veces}`}</span>
                      {step && step.produce > 1 && (
                        <span className={styles.stepNote}>{` · da ${step.produce * veces}`}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {leftovers.length > 0 && (
            <div className={styles.subsection}>
              <h4 className={styles.subTitle}>Sobrantes</h4>
              <ul className={styles.components}>
                {leftovers.map(({ key, nombre, cantidad }) => (
                  <li key={key}>
                    <ComponentChip
                      nombre={nombre}
                      cantidad={cantidad}
                      crafted
                      to={link(componentParams(key))}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {alternatives.map((key) => {
            const [first, ...others] = index.components.get(key)?.producers ?? [];
            return (
              <p key={key} className={styles.sectionNote}>
                {`${index.components.get(key)?.nombre ?? key} tiene más de una receta: se cuenta con `}
                <Link to={link(recipeParams(first))}>{nameOf(first)}</Link>
                {'; también sale de '}
                {others.map((id, position) => (
                  <span key={id}>
                    {position > 0 && ', '}
                    <Link to={link(recipeParams(id))}>{nameOf(id)}</Link>
                  </span>
                ))}
                .
              </p>
            );
          })}
          {cyclic && (
            <p className={styles.cyclic}>
              Desglose incompleto: alguna receta acaba pidiéndose a sí misma.
            </p>
          )}
        </DetailSection>
      )}

      <DetailSection title="Se usa en">
        {usedIn.length === 0 ? (
          <p className={styles.muted}>Ninguna otra receta lo pide.</p>
        ) : (
          <ul className={styles.uses}>
            {usedIn.map(({ recipe: id, cantidad, cargado }) => (
              <li key={id} className={styles.use}>
                <Link to={link(recipeParams(id))}>{nameOf(id)}</Link>
                <span className={styles.quantity}>{`×${cantidad}`}</span>
                {cargado && <span className={styles.charged}>cargado</span>}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      {recipe.requisitos && (
        <DetailSection title="Requisitos">
          <p className={styles.text}>{recipe.requisitos}</p>
        </DetailSection>
      )}
      {recipe.efecto && (
        <DetailSection title="Efecto">
          <p className={styles.text}>{recipe.efecto}</p>
        </DetailSection>
      )}
      {recipe.notas && (
        <DetailSection title="Notas">
          <p className={styles.text}>{recipe.notas}</p>
        </DetailSection>
      )}
    </article>
  );
}
