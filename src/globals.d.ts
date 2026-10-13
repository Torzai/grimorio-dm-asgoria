/** Absolute path of the repo with forward slashes; injected by vite.config.ts, empty in a build. */
declare const __REPO_ROOT__: string;

/** Built by src/content/vite-plugin-content.ts. */
declare module 'virtual:grimorio/content' {
  export const searchIndex: import('./content/search-index').SerializedIndex;
  export const pjIssues: import('./content/types').ContentIssue[];
  export const pjSummaries: Record<string, import('./content/pj-historial').PjSummary>;
  export const pjHistorialLoaders: Record<
    string,
    () => Promise<{ default: import('./content/pj-historial').PjHistorialData }>
  >;
}
