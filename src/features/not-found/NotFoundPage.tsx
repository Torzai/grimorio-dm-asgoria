import { Link } from 'react-router';
import { Page } from '@/ui/Page';

export function NotFoundPage() {
  return (
    <Page
      title="Página no encontrada"
      subtitle="Esta ruta no corresponde a ninguna categoría ni ficha del grimorio."
      documentTitle="Página no encontrada"
    >
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </Page>
  );
}
