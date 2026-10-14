import { createBrowserRouter, type RouteObject } from 'react-router';
import { EntryListEmpty } from '@/features/entry-list/EntryListEmpty';
import { EntryListLayout } from '@/features/entry-list/EntryListLayout';
import { EntryPage } from '@/features/entry-view/EntryPage';
import { OficioIndex, OficioPage } from '@/features/entry-view/oficio/OficioPage';
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
      // Oficios have no list column: /oficio opens the first, and each one is a tab of the view.
      {
        path: 'oficio',
        children: [
          { index: true, element: <OficioIndex /> },
          { path: ':slug', element: <OficioPage /> },
        ],
      },
      // The list stays mounted while the child changes. Unknown types render NotFoundPage from
      // the layout, unknown slugs from EntryPage.
      {
        path: ':type',
        element: <EntryListLayout />,
        children: [
          { index: true, element: <EntryListEmpty /> },
          { path: ':slug', element: <EntryPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
