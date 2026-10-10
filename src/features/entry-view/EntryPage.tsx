import { useParams } from 'react-router';
import { getEntry, isEntryType } from '@/content/content-queries';
import { useContent } from '@/content/use-content';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { Page } from '@/ui/Page';

export function EntryPage() {
  const { type, slug = '' } = useParams();
  const { entries } = useContent();
  const entry = isEntryType(type) ? getEntry(entries, type, slug) : undefined;
  if (!entry) return <NotFoundPage />;
  return <Page title={entry.data.title} documentTitle={entry.data.title} />;
}
