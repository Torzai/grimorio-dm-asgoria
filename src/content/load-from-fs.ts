import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { loadEntries, type LoadResult } from './loader';

/** Node-only: reads <rootDir>/content/**\/*.md and runs the shared loader. */
export async function loadContentFromFs(rootDir: string): Promise<LoadResult> {
  const contentDir = join(rootDir, 'content');
  const dirents = await readdir(contentDir, { recursive: true, withFileTypes: true });

  const files: Record<string, string> = {};
  await Promise.all(
    dirents
      .filter((dirent) => dirent.isFile() && dirent.name.toLowerCase().endsWith('.md'))
      .map(async (dirent) => {
        const fullPath = join(dirent.parentPath, dirent.name);
        const key = `content/${relative(contentDir, fullPath).split(sep).join('/')}`;
        files[key] = await readFile(fullPath, 'utf8');
      }),
  );

  return loadEntries(files);
}
