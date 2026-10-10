import { useMemo } from 'react';
import { useParams } from 'react-router';
import { countByType, isEntryType } from '@/content/content-queries';
import { TYPE_LABELS } from '@/content/type-labels';
import type { EntryType } from '@/content/types';
import { useContent } from '@/content/use-content';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { Page } from '@/ui/Page';

export function EntryListPage() {
  const { type } = useParams();
  if (!isEntryType(type)) return <NotFoundPage />;
  return <EntryList type={type} />;
}

function EntryList({ type }: { type: EntryType }) {
  const { entries } = useContent();
  const count = useMemo(() => countByType(entries)[type], [entries, type]);
  const label = TYPE_LABELS[type].plural;
  return (
    <Page
      title={label}
      subtitle={count === 1 ? '1 ficha' : `${count} fichas`}
      documentTitle={label}
    />
  );
}
