/** Absolute path of the repo with forward slashes; injected by vite.config.ts, empty in a build. */
declare const __REPO_ROOT__: string;

/** Built by src/content/vite-plugin-content.ts; loaded up front. */
declare module 'virtual:grimorio/content' {
  export const entries: import('./content/types').EntryMeta[];
  export const issues: import('./content/types').ContentIssue[];
  /** The maps of the link graph as [key, value] pairs. */
  export const links: import('./content/links').SerializedLinkMaps;
  /** Totals of each history (PJ, crónica), by slug. */
  export const historialSummaries: Record<
    string,
    import('./content/historial-items').HistorialSummary
  >;
  /** Each history without the text of its entries, in its type's order, by slug. */
  export const historialItems: Record<
    string,
    import('./content/historial-items').HistorialItemMeta[]
  >;
  /** What is derived from each crónica at build time, by slug. */
  export const cronicas: Record<string, import('./content/cronica').CronicaMeta>;
}

/** Built by src/content/vite-plugin-content.ts; its own chunk, loaded by search-data.ts. */
declare module 'virtual:grimorio/search-index' {
  const index: import('./content/search-index').SerializedIndex;
  export default index;
}
