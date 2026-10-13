import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSearchIndex } from '@/content/search-data';
import { search } from '@/content/search-index';
import { queryTerms } from '@/content/highlight';
import { Page } from '@/ui/Page';
import {
  KIND_LABELS,
  groupResults,
  isResultKind,
  kindOf,
  searchPageTarget,
} from './palette-results';
import { ResultGroups } from './ResultGroups';
import styles from './SearchPage.module.css';

/** Results shown at most; a broad query in the history can match thousands of entries. */
const LIMIT = 200;

/**
 * /buscar?q=&type= — every result, grouped as in the palette, which links here from its
 * "Ver N más". 'type' is an entry type or 'historial'.
 */
export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const typeParam = params.get('type');
  const kind = isResultKind(typeParam) ? typeParam : undefined;
  // Usually loaded already; until it is, the results are left out rather than shown empty.
  const index = useSearchIndex();
  const found = useMemo(() => {
    if (!index) return undefined;
    const all = search(index, query, { limit: Infinity });
    const ofKind = kind ? all.filter((result) => kindOf(result) === kind) : all;
    return { total: ofKind.length, groups: groupResults(ofKind.slice(0, LIMIT)) };
  }, [index, query, kind]);
  const terms = useMemo(() => queryTerms(query), [query]);

  const where = kind ? ` en ${KIND_LABELS[kind]}` : '';
  return (
    <Page
      title="Buscar"
      subtitle={
        query
          ? `Resultados para «${query}»${where}`
          : 'Pulsa Ctrl+K o / para buscar en el grimorio.'
      }
      documentTitle={query ? `${query} · Buscar` : 'Buscar'}
    >
      {query && found && (
        <div className={styles.results}>
          {kind && (
            <Link className={styles.allKinds} to={searchPageTarget(query)}>
              Ver resultados de todos los tipos
            </Link>
          )}
          {found.total > LIMIT && (
            <p className={styles.note}>
              {`Se muestran los ${LIMIT} mejores de ${found.total}; afina la búsqueda para ver el resto.`}
            </p>
          )}
          {found.total > 0 ? (
            <ResultGroups groups={found.groups} query={query} terms={terms} />
          ) : (
            <p className={styles.empty}>No hay fichas que coincidan.</p>
          )}
        </div>
      )}
    </Page>
  );
}
