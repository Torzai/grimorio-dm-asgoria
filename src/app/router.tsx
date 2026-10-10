import { createBrowserRouter, type RouteObject } from 'react-router';
import { EntryListPage } from '@/features/entry-list/EntryListPage';
import { EntryPage } from '@/features/entry-view/EntryPage';
import { HomePage } from '@/features/home/HomePage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { SearchPage } from '@/features/palette/SearchPage';
import { AppShell } from './AppShell';

// Exported on their own so tests can mount them in a memory router.
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'buscar', element: <SearchPage /> },
      // Unknown types and slugs render NotFoundPage from the page itself.
      { path: ':type', element: <EntryListPage /> },
      { path: ':type/:slug', element: <EntryPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
