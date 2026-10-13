import { useMemo, type ReactNode } from 'react';
import { getZoneTitles } from '@/content/content-queries';
import { pjHistorialOf, pjSummaryOf } from '@/content/pj-data';
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
      body = <HistorialPreview slug={result.slug} hit={result.historial} terms={terms} />;
    } else if (entry?.data.type === 'pj') {
      body = <PjPreview slug={entry.slug} data={entry.data} />;
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
  const summary = pjSummaryOf(slug);
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

function HistorialPreview({
  slug,
  hit,
  terms,
}: {
  slug: string;
  hit: HistorialHit;
  terms: readonly string[];
}) {
  const item = pjHistorialOf(slug).find((candidate) => candidate.id === hit.entryId);
  return (
    <>
      <span className={styles.eyebrow}>Entrada de historial</span>
      <h2 className={styles.title}>{hit.pjTitle}</h2>
      {item && (
        <>
          <dl className={styles.facts}>
            <Fact label="Fecha">{formatNumericDate(item.date)}</Fact>
            <Fact label="Narró">{item.authorName}</Fact>
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
