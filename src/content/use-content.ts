import { createContext, useContext } from 'react';
import type { Content } from './build-content';

// Lives apart from ContentContext.tsx so that file only exports components (Fast Refresh).
export const ContentContext = createContext<Content | null>(null);

export function useContent(): Content {
  const content = useContext(ContentContext);
  if (!content) throw new Error('useContent must be used inside <ContentProvider>');
  return content;
}
