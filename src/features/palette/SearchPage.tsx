import { useSearchParams } from 'react-router';
import { Page } from '@/ui/Page';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  return (
    <Page
      title="Buscar"
      subtitle={
        query ? `Resultados para «${query}»` : 'Escribe algo en el buscador de la cabecera.'
      }
      documentTitle={query ? `${query} · Buscar` : 'Buscar'}
    />
  );
}
