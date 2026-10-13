import { useMemo } from 'react';
import { Link, createSearchParams, useSearchParams, type To } from 'react-router';
import { search, type SearchResult } from '@/content/search-index';
import { TYPE_LABELS } from '@/content/type-labels';
import { useContent } from '@/content/use-content';
import { Page } from '@/ui/Page';
import styles from './SearchPage.module.css';

const LIMIT = 50;

/** /buscar?q= — every result; the palette (T08) will show the first ones. */
export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const { index } = useContent();
  const results = useMemo(() => search(index, query, { limit: LIMIT }), [index, query]);

  return (
    <Page
      title="Buscar"
      subtitle={
        query ? `Resultados para «${query}»` : 'Escribe algo en el buscador de la cabecera.'
      }
      documentTitle={query ? `${query} · Buscar` : 'Buscar'}
    >
      {query &&
        (results.length > 0 ? (
          <ol className={styles.results}>
            {results.map((result) => (
              <li key={resultKey(result)}>
                <Link className={styles.result} to={resultTarget(result, query)}>
                  <span className={styles.title}>{result.title}</span>
                  <span className={styles.meta}>{resultMeta(result)}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No hay fichas que coincidan.</p>
        ))}
    </Page>
  );
}

function resultKey(result: SearchResult): string {
  return result.historial ? `${result.slug}#${result.historial.entryId}` : result.slug;
}

/**
 * A history entry opens its PJ on that entry, with the query as the history's search so the
 * words come highlighted.
 */
function resultTarget(result: SearchResult, query: string): To {
  if (!result.historial) return `/${result.type}/${result.slug}`;
  return {
    pathname: `/${result.type}/${result.slug}`,
    search: `?${createSearchParams({ tab: 'historial', q: query })}`,
    hash: result.historial.entryId,
  };
}

function resultMeta(result: SearchResult): string {
  if (result.historial) return 'Entrada de historial';
  return [TYPE_LABELS[result.type].singular, result.resumen].filter(Boolean).join(' · ');
}
