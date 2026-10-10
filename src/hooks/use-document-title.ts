import { useEffect } from 'react';

export const APP_NAME = 'Grimorio del DM';

/** 'NPCs · Grimorio del DM', or just the app name without a page title. */
export function useDocumentTitle(pageTitle?: string): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}
