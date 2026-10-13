import { createContext, useContext } from 'react';

/** What a search box needs to open the palette; PaletteProvider owns the state. */
export interface PaletteControls {
  isOpen: boolean;
  /** The query, kept between openings: the search boxes show it. */
  query: string;
  /** Opens the palette; the focus goes back to `opener` when it closes with Esc. */
  openFrom: (opener: HTMLElement | null) => void;
  /** True while the focus goes back to the opener, which must not open the palette again. */
  isRestoringFocus: () => boolean;
}

// Lives apart from CommandPalette.tsx so that file only exports components (Fast Refresh).
export const PaletteContext = createContext<PaletteControls | null>(null);

export function usePalette(): PaletteControls {
  const controls = useContext(PaletteContext);
  if (!controls) throw new Error('usePalette must be used inside <PaletteProvider>');
  return controls;
}
