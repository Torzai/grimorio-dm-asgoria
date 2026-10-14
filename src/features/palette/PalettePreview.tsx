import { useMemo, type ReactNode } from 'react';
import { getZoneTitles } from '@/content/content-queries';
import { hasThreadView, isThreadType, THREAD_PROFILES, type ThreadType } from '@/content/cronica';
import { cronicaMetaOf } from '@/content/cronica-data';
import { historialItemsOf, historialSummaryOf } from '@/content/historial-data';
import {
  familyLabel,
  indexOficio,
  parseOficioAnchor,
  recipesOf,
  type CatalogComponent,
  type Habilidad,
  type OficioIndex,
  type Recipe,
} from '@/content/oficio';
import { oficioMetaOf } from '@/content/oficio-data';
import type { HistorialHit, SearchResult } from '@/content/search-index';
import { PJ_ESTADO_LABELS, TYPE_LABELS } from '@/content/type-labels';
import type { EntryMeta } from '@/content/types';
import { useContent } from '@/content/use-content';
import { formatNumericDate } from '@/features/entry-list/entry-meta';
import { Highlighted } from './Highlighted';
import { KIND_LABELS, type ResultOption } from './palette-results';
import styles from './PalettePreview.module.css';

interface PalettePreviewProps {
  option: ResultOption;
  terms: readonly string[];
}

/**
 * The selected result, from metadata only: nothing here loads a body, so moving through the
 * list never waits.
 */
export function PalettePreview({ option, terms }: PalettePreviewProps) {
  const { entries } = useContent();
  const byKey = useMemo(
    () => new Map(entries.map((entry) => [`${entry.type}/${entry.slug}`, entry])),
    [entries],
  );
  const zoneTitles = useMemo(() => getZoneTitles(entries), [entries]);

  let body: ReactNode;
  if ('more' in option) {
    body = (
      <>
        <span className={styles.eyebrow}>{KIND_LABELS[option.kind]}</span>
        <p className={styles.hint}>
          {`${option.more} resultados más de este tipo. Enter los abre en la página de búsqueda.`}
        </p>
      </>
    );
  } else {
    const { result } = option;
    const entry = byKey.get(`${result.type}/${result.slug}`);
    if (result.historial) {
      body = (
        <HistorialPreview
          slug={result.slug}
          thread={isThreadType(result.type) ? result.type : undefined}
          hit={result.historial}
          terms={terms}
        />
      );
    } else if (entry?.data.type === 'pj') {
      body = <PjPreview slug={entry.slug} data={entry.data} />;
    } else if (entry?.data.type === 'oficio') {
      body = (
        <OficioPreview
          slug={entry.slug}
          data={entry.data}
          anchor={result.section?.anchor}
          terms={terms}
        />
      );
    } else {
      body = <EntryPreview result={result} entry={entry} zoneTitles={zoneTitles} />;
    }
  }

  return (
    <section className={styles.preview} aria-label="Vista previa">
      {body}
    </section>
  );
}

function PjPreview({ slug, data }: { slug: string; data: EntryMeta<'pj'>['data'] }) {
  const summary = historialSummaryOf(slug);
  const { estado, raza, clases = [], cuenta_nwn } = data;
  const identity = [raza, clases.join(' / ')].filter(Boolean).join(' · ');
  return (
    <>
      <span className={styles.eyebrow}>
        {'PJ · '}
        <span className={styles.estado} data-estado={estado}>
          <span aria-hidden="true">● </span>
          {PJ_ESTADO_LABELS[estado]}
        </span>
      </span>
      <h2 className={styles.title}>{data.title}</h2>
      {identity && <p className={styles.identity}>{identity}</p>}
      <dl className={styles.facts}>
        <Fact label="Última actividad">
          {summary?.last ? formatNumericDate(summary.last) : 'Sin historial'}
        </Fact>
        <Fact label="Quests">{summary?.total ?? 0}</Fact>
        <Fact label="Cuenta">
          <span className={styles.mono}>{cuenta_nwn}</span>
        </Fact>
      </dl>
    </>
  );
}

/** A recipe, component or skill of an oficio, by the anchor of the result; or the oficio. */
function OficioPreview({
  slug,
  data,
  anchor,
  terms,
}: {
  slug: string;
  data: EntryMeta<'oficio'>['data'];
  /** Anchor of the part the result is ('r-…', 'c-…', 'h-…'); undefined for the oficio. */
  anchor: string | undefined;
  terms: readonly string[];
}) {
  const meta = oficioMetaOf(slug);
  const part = anchor === undefined ? undefined : parseOficioAnchor(anchor);
  const index = meta && indexOficio(meta);
  if (index && part?.kind === 'receta') {
    const recipe = index.recipes.get(part.value);
    if (recipe)
      return <RecipePreview oficio={data.title} recipe={recipe} index={index} terms={terms} />;
  } else if (index && part?.kind === 'componente') {
    const component = index.components.get(part.value);
    if (component)
      return <ComponentPreview oficio={data.title} component={component} index={index} />;
  } else if (index && part?.kind === 'habilidad') {
    const skill = index.skills.get(Number(part.value));
    if (skill) return <SkillPreview oficio={data.title} skill={skill} index={index} />;
  }
  return (
    <>
      <span className={styles.eyebrow}>{TYPE_LABELS.oficio.singular}</span>
      <h2 className={styles.title}>{data.title}</h2>
      {meta && (
        <dl className={styles.facts}>
          <Fact label="Recetas">{recipesOf(meta).length}</Fact>
          <Fact label="Componentes">{meta.components.length}</Fact>
          <Fact label="Habilidades">{meta.skills.length}</Fact>
        </dl>
      )}
      {data.resumen && <p className={styles.text}>{data.resumen}</p>}
    </>
  );
}

function RecipePreview({
  oficio,
  recipe,
  index,
  terms,
}: {
  oficio: string;
  recipe: Recipe;
  index: OficioIndex;
  terms: readonly string[];
}) {
  const usedIn = index.components.get(recipe.producto.key)?.usedIn ?? [];
  return (
    <>
      <span className={styles.eyebrow}>{`Receta · ${oficio}`}</span>
      <h2 className={styles.title}>{recipe.nombre}</h2>
      <dl className={styles.facts}>
        <Fact label="Nivel">{recipe.nivel ?? '—'}</Fact>
        <Fact label="DC">{recipe.dc ?? '—'}</Fact>
        <Fact label="Produce">{`×${recipe.produce}`}</Fact>
      </dl>
      {!recipe.disponible && <p className={styles.text}>No disponible.</p>}
      <Field label="Componentes">
        <ul className={styles.chips}>
          {recipe.componentes.map(({ key, nombre, cantidad, cargado }) => (
            <li key={key} className={styles.chip}>
              <Highlighted text={nombre} terms={terms} />
              {` ×${cantidad}${cargado ? ' · cargado' : ''}`}
            </li>
          ))}
        </ul>
      </Field>
      {usedIn.length > 0 && (
        <Field label="Se usa en">
          <p className={styles.text}>
            {usedIn.map(({ recipe: id }) => index.recipes.get(id)?.nombre ?? id).join(' · ')}
          </p>
        </Field>
      )}
    </>
  );
}

function ComponentPreview({
  oficio,
  component,
  index,
}: {
  oficio: string;
  component: CatalogComponent;
  index: OficioIndex;
}) {
  const { nombre, familia, producers, usedIn } = component;
  const names = (ids: readonly string[]) =>
    ids.map((id) => index.recipes.get(id)?.nombre ?? id).join(' · ');
  return (
    <>
      <span className={styles.eyebrow}>{`Componente · ${oficio}`}</span>
      <h2 className={styles.title}>{nombre}</h2>
      <dl className={styles.facts}>
        <Fact label="Familia">{familyLabel(familia)}</Fact>
        <Fact label="Tipo">{producers.length > 0 ? 'Fabricable' : 'Base'}</Fact>
        <Fact label="Usado en">
          {usedIn.length === 1 ? '1 receta' : `${usedIn.length} recetas`}
        </Fact>
      </dl>
      <Field label="Se obtiene de">
        <p className={styles.text}>{producers.length > 0 ? names(producers) : 'Material base'}</p>
      </Field>
      {usedIn.length > 0 && (
        <Field label="Se usa en">
          <p className={styles.text}>{names(usedIn.map(({ recipe }) => recipe))}</p>
        </Field>
      )}
    </>
  );
}

function SkillPreview({
  oficio,
  skill,
  index,
}: {
  oficio: string;
  skill: Habilidad;
  index: OficioIndex;
}) {
  const { numero, nivel, nombre, requiere, axp, descripcion } = skill;
  const required = requiere === undefined ? undefined : index.skills.get(requiere);
  return (
    <>
      <span className={styles.eyebrow}>{`Habilidad · ${oficio}`}</span>
      <h2 className={styles.title}>{`${numero} · ${nombre}`}</h2>
      <dl className={styles.facts}>
        <Fact label="Nivel">{nivel}</Fact>
        <Fact label="Coste">{axp === undefined ? '—' : `${axp} aXP`}</Fact>
        <Fact label="Requiere">
          {requiere === undefined
            ? '—'
            : required
              ? `${requiere} · ${required.nombre}`
              : `nº ${requiere}`}
        </Fact>
      </dl>
      <p className={styles.text}>{descripcion}</p>
    </>
  );
}

/** A PJ's quest, or the annex of a thread (crónica, lore) under the entry's name. */
function HistorialPreview({
  slug,
  thread,
  hit,
  terms,
}: {
  slug: string;
  /** The type of the thread the annex belongs to; undefined for a PJ's quest. */
  thread: ThreadType | undefined;
  hit: HistorialHit;
  terms: readonly string[];
}) {
  const item = historialItemsOf(slug).find((candidate) => candidate.id === hit.entryId);
  return (
    <>
      <span className={styles.eyebrow}>
        {thread
          ? `Anexo de ${THREAD_PROFILES[thread].heading.toLowerCase()}`
          : 'Entrada de historial'}
      </span>
      <h2 className={styles.title}>{hit.parentTitle}</h2>
      {item?.title && (
        <p className={styles.identity}>
          <Highlighted text={item.title} terms={terms} />
        </p>
      )}
      {item && (
        <>
          <dl className={styles.facts}>
            <Fact label="Fecha">{formatNumericDate(item.date)}</Fact>
            <Fact label={thread ? 'Autor' : 'Narró'}>{item.authorName}</Fact>
          </dl>
          {item.participantes.length > 0 && (
            <Field label="Participantes">
              <ul className={styles.chips}>
                {item.participantes.map((name) => (
                  <li key={name} className={styles.chip}>
                    <Highlighted text={name} terms={terms} />
                  </li>
                ))}
              </ul>
            </Field>
          )}
          {item.preview && (
            <p className={styles.text}>
              <Highlighted text={item.preview} terms={terms} />
            </p>
          )}
        </>
      )}
    </>
  );
}

function EntryPreview({
  result,
  entry,
  zoneTitles,
}: {
  result: SearchResult;
  entry: EntryMeta | undefined;
  zoneTitles: ReadonlyMap<string, string>;
}) {
  const zona = entry?.data.zona ?? result.zona;
  const eyebrow = [TYPE_LABELS[result.type].singular, zona && (zoneTitles.get(zona) ?? zona)]
    .filter(Boolean)
    .join(' · ');
  const data = entry?.data;
  const tags = data?.tags ?? [];
  const resumen = data?.resumen ?? result.resumen;
  const thread =
    entry &&
    isThreadType(entry.type) &&
    hasThreadView(entry, historialSummaryOf(result.slug)?.total ?? 0)
      ? entry.type
      : undefined;

  return (
    <>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2 className={styles.title}>{result.title}</h2>
      {data?.type === 'varita' && (
        <dl className={styles.facts}>
          <Fact label="Cargas">{data.cargas ?? '—'}</Fact>
          <Fact label="NL">{data.nivel_lanzador ?? '—'}</Fact>
          <Fact label="Recarga">
            {data.recarga === undefined ? '—' : data.recarga ? 'Sí' : 'No'}
          </Fact>
        </dl>
      )}
      {thread && <CronicaFacts type={thread} slug={result.slug} anchor={result.section?.anchor} />}
      {resumen && <p className={styles.text}>{resumen}</p>}
      {data?.type === 'varita' && data.uso && (
        <Field label="Uso">
          <code className={styles.code}>{data.uso}</code>
        </Field>
      )}
      {data?.type === 'comando' && (
        <Field label="Sintaxis">
          <code className={styles.code}>{data.sintaxis}</code>
        </Field>
      )}
      {tags.length > 0 && (
        <Field label="Tags">
          <ul className={styles.chips}>
            {tags.map((tag) => (
              <li key={tag} className={styles.chip}>
                {tag}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </>
  );
}

/** When the thread was last updated, and the block of its situation the result is. */
function CronicaFacts({
  type,
  slug,
  anchor,
}: {
  type: ThreadType;
  slug: string;
  anchor: string | undefined;
}) {
  const meta = cronicaMetaOf(slug);
  const block = meta?.situacion.blocks.find(({ id }) => id === anchor);
  return (
    <dl className={styles.facts}>
      <Fact label="Última actualización">
        {meta?.updated ? formatNumericDate(meta.updated) : '—'}
      </Fact>
      {block ? (
        <Fact label={THREAD_PROFILES[type].heading}>{block.label}</Fact>
      ) : (
        <Fact label="Anexos">{historialSummaryOf(slug)?.total ?? 0}</Fact>
      )}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}
