import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { buildContent, type Content } from './build-content';

/** Node-only: reads <rootDir>/content/**\/*.md and builds the shared content. */
export async function loadContentFromFs(rootDir: string): Promise<Content> {
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

  return buildContent(files);
}
