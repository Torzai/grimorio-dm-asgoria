/**
 * 'vscode://file/<absolute path>' for a repo-relative path, to open the .md in the editor.
 * The root uses forward slashes ('C:/Users/me/repo' on Windows, '/home/me/repo' elsewhere).
 */
export function editorUrl(repoRoot: string, entryPath: string): string {
  const root = repoRoot.replace(/^\/+|\/+$/g, '');
  // encodeURI keeps '/' and the drive's ':', but not '?' and '#', which would cut the path.
  return encodeURI(`vscode://file/${root}/${entryPath}`).replace(/[?#]/g, encodeURIComponent);
}
