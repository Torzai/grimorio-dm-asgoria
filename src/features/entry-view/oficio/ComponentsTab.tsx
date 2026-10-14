import { useId, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { queryTerms } from '@/content/highlight';
import {
  FAMILIES,
  familyLabel,
  indexOficio,
  type CatalogComponent,
  type OficioIndex,
  type OficioMeta,
} from '@/content/oficio';
import { Highlighted } from '@/features/palette/Highlighted';
import { filterComponents, isFamily, isOrigin, originOf } from './oficio-filter';
import {
  componentParams,
  recipeParams,
  useParamLink,
  useQueryParam,
  useSetParams,
} from './oficio-url';
import {
  ChipGroup,
  DetailEmpty,
  DetailSection,
  HammerIcon,
  ListSection,
  MasterDetail,
  SearchBox,
} from './OficioParts';
import { handleRowKeys, levelAndDc, plural, useDetailFocus, useRevealRow } from './master-detail';
import styles from './OficioView.module.css';

/**
 * Componentes: every component by family, filtered (?cq=&origen=&familia=), and the open one
 * (?c=) with the recipes that make it and all the recipes that ask for it.
 */
export function ComponentsTab({ meta }: { meta: OficioMeta }) {
  const index = indexOficio(meta);
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const link = useParamLink();
  const [query, setQuery] = useQueryParam('cq');

  const selected = index.components.get(params.get('c') ?? '');
  const selectedKey = selected?.key;
  const originParam = params.get('origen');
  const origin = isOrigin(originParam) ? originParam : undefined;
  const familyParam = params.get('familia');
  const family = isFamily(familyParam) ? familyParam : undefined;

  const terms = useMemo(() => queryTerms(query), [query]);
  const filtered = filterComponents(meta, { terms, origin, family }, selectedKey);
  const visible = filtered.flatMap(({ components }) => components);
  const total = meta.components.length;
  const filtering = terms.length > 0 || origin !== undefined || family !== undefined;
  const focusKey = selected && visible.includes(selected) ? selected.key : visible[0]?.key;
  const crafted = meta.components.filter((component) => originOf(component) === 'fabricable');
  const present = FAMILIES.filter(({ id }) =>
    meta.components.some((component) => component.familia === id),
  );

  const listRef = useRef<HTMLDivElement>(null);
  useRevealRow(listRef, selectedKey);

  function clearFilters() {
    setQuery('');
    setParams({ cq: undefined, origen: undefined, familia: undefined });
  }

  const master = (
    <>
      <div className={styles.filters}>
        <SearchBox
          label="Buscar componentes"
          value={query}
          placeholder="Nombre del componente…"
          status={filtering ? `${visible.length} de ${total}` : ''}
          onChange={setQuery}
        />
        <ChipGroup
          label="Tipo"
          options={[
            { value: 'base', label: 'Base', count: total - crafted.length },
            { value: 'fabricable', label: 'Fabricable', count: crafted.length },
          ]}
          selected={origin}
          onSelect={(value) => setParams({ origen: value })}
        />
        <ChipGroup
          label="Familia"
          options={present.map(({ id, label }) => ({
            value: id,
            label,
            count: meta.components.filter((component) => component.familia === id).length,
          }))}
          selected={family}
          onSelect={(value) => setParams({ familia: value })}
        />
        {filtering && (
          <button type="button" className={styles.clear} onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>
      <div ref={listRef} className={styles.list} onKeyDown={handleRowKeys}>
        <h2 className="visually-hidden">Lista de componentes</h2>
        {visible.length === 0 ? (
          <p className={styles.empty}>
            {total === 0
              ? 'Este oficio todavía no tiene componentes.'
              : 'Ningún componente coincide con los filtros.'}
          </p>
        ) : (
          filtered.map(({ family: id, label, components }) => {
            const all = meta.components.filter((component) => component.familia === id).length;
            return (
              <ListSection
                key={id}
                title={label}
                count={filtering ? `${components.length} de ${all}` : String(all)}
              >
                {components.map((component) => (
                  <li key={component.key}>
                    <Link
                      data-row=""
                      className={styles.row}
                      to={link(componentParams(component.key))}
                      aria-current={component.key === selectedKey ? 'page' : undefined}
                      tabIndex={component.key === focusKey ? 0 : -1}
                    >
                      <span className={styles.rowTitle}>
                        {originOf(component) === 'fabricable' && <HammerIcon />}
                        <Highlighted text={component.nombre} terms={terms} />
                        {originOf(component) === 'fabricable' && (
                          <span className="visually-hidden"> (fabricable)</span>
                        )}
                      </span>
                      <span className={styles.rowMeta}>{usedInText(component)}</span>
                    </Link>
                  </li>
                ))}
              </ListSection>
            );
          })
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
          <ComponentDetail component={selected} index={index} />
        ) : (
          <DetailEmpty
            title="Elige un componente de la lista"
            lead={`${plural(total, 'componente', 'componentes')} · ${plural(total - crafted.length, 'material base', 'materiales base')} y ${plural(crafted.length, 'fabricable', 'fabricables')}`}
          />
        )
      }
      back={{ to: link({ c: undefined }), label: 'Volver a los componentes' }}
    />
  );
}

function usedInText({ usedIn, producers }: CatalogComponent): string {
  if (usedIn.length > 0) return `usado en ${usedIn.length}`;
  return producers.length > 0 ? 'producto final' : 'sin uso';
}

interface ComponentDetailProps {
  component: CatalogComponent;
  index: OficioIndex;
}

/** A component: the recipes that make it (or "Material base") and every recipe that uses it. */
function ComponentDetail({ component, index }: ComponentDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useDetailFocus(component.key, headingRef);
  const link = useParamLink();
  const { nombre, familia, producers, usedIn } = component;

  // The uses by group of the recipe, in the order of the file.
  const byGroup = new Map<string, typeof usedIn>();
  for (const use of usedIn) {
    const group = index.recipes.get(use.recipe)?.group ?? '';
    byGroup.set(group, [...(byGroup.get(group) ?? []), use]);
  }

  return (
    <article className={styles.detailCard} aria-labelledby={headingId}>
      <header className={styles.detailHead}>
        <p className={styles.detailKicker}>{familyLabel(familia)}</p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.detailTitle}>
          {nombre}
        </h2>
        <p className={styles.detailMeta}>
          {[
            producers.length > 0 ? 'Fabricable' : 'Material base',
            usedIn.length > 0
              ? `se usa en ${plural(usedIn.length, 'receta', 'recetas')}`
              : 'ninguna receta lo pide',
          ].join(' · ')}
        </p>
      </header>

      <DetailSection title="Se obtiene de">
        {producers.length === 0 ? (
          <p className={styles.muted}>Material base: no se fabrica en este oficio.</p>
        ) : (
          <ul className={styles.uses}>
            {producers.map((id) => {
              const recipe = index.recipes.get(id);
              return (
                <li key={id} className={styles.use}>
                  <Link to={link(recipeParams(id))}>{recipe?.nombre ?? id}</Link>
                  {recipe && (
                    <>
                      <span className={styles.quantity}>{`da ${recipe.produce}`}</span>
                      <span className={styles.useMeta}>
                        {[levelAndDc(recipe), recipe.disponible ? '' : 'No disponible']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={`Se usa en · ${usedIn.length}`}>
        {usedIn.length === 0 ? (
          <p className={styles.muted}>Ninguna receta de este oficio lo pide.</p>
        ) : (
          [...byGroup].map(([group, uses]) => (
            <div key={group} className={styles.subsection}>
              {byGroup.size > 1 && (
                <h4 className={styles.subTitle}>{index.groups.get(group)?.nombre ?? group}</h4>
              )}
              <ul className={styles.uses}>
                {uses.map(({ recipe: id, cantidad, cargado }) => {
                  const recipe = index.recipes.get(id);
                  return (
                    <li key={id} className={styles.use}>
                      <Link to={link(recipeParams(id))}>{recipe?.nombre ?? id}</Link>
                      <span className={styles.quantity}>{`×${cantidad}`}</span>
                      {cargado && <span className={styles.charged}>cargado</span>}
                      {recipe && <span className={styles.useMeta}>{levelAndDc(recipe)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </DetailSection>
    </article>
  );
}
