/** Absolute path of the repo with forward slashes; injected by vite.config.ts, empty in a build. */
declare const __REPO_ROOT__: string;

/** Built by src/content/vite-plugin-content.ts; loaded up front. */
declare module 'virtual:grimorio/content' {
  export const entries: import('./content/types').EntryMeta[];
  export const issues: import('./content/types').ContentIssue[];
  /** The maps of the link graph as [key, value] pairs. */
  export const links: Record<keyof import('./content/links').LinkMaps, [string, string[]][]>;
  export const pjSummaries: Record<string, import('./content/pj-historial').PjSummary>;
  /** Each PJ's history without the text of its entries, newest first. */
  export const pjHistoriales: Record<string, import('./content/pj-historial').HistorialItemMeta[]>;
}

/** Built by src/content/vite-plugin-content.ts; its own chunk, loaded by search-data.ts. */
declare module 'virtual:grimorio/search-index' {
  const index: import('./content/search-index').SerializedIndex;
  export default index;
}
