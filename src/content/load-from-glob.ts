import { buildContent, type Content } from './build-content';

const files = import.meta.glob<string>('/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Browser-only: content bundled by Vite at build time. */
export function loadContentFromGlob(): Content {
  return buildContent(files);
}
