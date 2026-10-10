// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHtml } from './html';
import { isLoggedOutPage } from './session';
import {
  countPosts,
  extractPosts,
  mergePosts,
  pageFileName,
  pageNumberOf,
  readPagination,
  readThreadInfo,
  threadSlug,
  type ForumPost,
} from './thread-page';

const THREAD_URL = 'https://asgoria.com.ar/foro/topic/aldric-pruebas-cuentaficticia01';
const page = parseHtml(
  readFileSync(new URL('../__fixtures__/thread-page.html', import.meta.url), 'utf8'),
);
const { posts, problems } = extractPosts(page, 1);

describe('extractPosts', () => {
  it('reads number, author, @usuario and date of the posts of the page', () => {
    expect(problems).toEqual([]);
    expect(
      posts.map(({ number, authorName, authorHandle, postedAt, page }) => ({
        number,
        authorName,
        authorHandle,
        postedAt,
        page,
      })),
    ).toEqual([
      {
        number: 1,
        authorName: 'Cuenta Sistema',
        authorHandle: 'cuenta-sistema',
        postedAt: '2021-03-05T00:05',
        page: 1,
      },
      {
        number: 2,
        authorName: 'Narradora Ficticia',
        authorHandle: 'narradora-ficticia',
        postedAt: '2021-03-10T12:45',
        page: 1,
      },
      {
        number: 3,
        authorName: 'Jugador de Prueba',
        authorHandle: 'jugador-prueba',
        postedAt: '2021-03-11T21:07',
        page: 1,
      },
    ]);
  });

  it('ignores a post pasted inside another one', () => {
    expect(countPosts(page)).toBe(3);
    expect(posts.map(({ number }) => number)).not.toContain(7);
  });

  it('keeps no roles: the DM and Staff badges are not part of the data', () => {
    for (const post of posts) expect(post).not.toHaveProperty('authorRoles');
    expect(JSON.stringify(posts)).not.toContain('usergroup');
  });

  it('reads who edited a post and when, from the post itself', () => {
    expect(posts[2]).toMatchObject({
      editedAt: '2021-03-12T21:15',
      editedBy: 'Narradora Ficticia',
    });
    expect(posts[1]).not.toHaveProperty('editedAt');
    expect(posts[1]).not.toHaveProperty('editedBy');
  });

  it('leaves signature, reactions and the hidden quote copy out of the body', () => {
    const body = posts[1].html;
    expect(body).toContain('Aldric - Brunilda - Cedric');
    expect(body).not.toContain('Firma ficticia de la narradora');
    expect(body).not.toContain('thumbs');
    expect(body).not.toContain('Le gusta a');
    expect(body).not.toContain('COPIA OCULTA');
  });
});

describe('thread pages', () => {
  it('reads "Página 1 de 2" and the URL of the next page', () => {
    expect(readPagination(page, THREAD_URL)).toEqual({
      current: 1,
      total: 2,
      nextUrl: `${THREAD_URL}?part=2`,
    });
  });

  it('has no next page on the last one', () => {
    const last = parseHtml(
      '<div id="af-wrapper"><div class="pages"><strong>Página 2 de 2</strong></div></div>',
    );
    expect(readPagination(last, `${THREAD_URL}?part=2`)).toEqual({ current: 2, total: 2 });
  });

  it('reads the canonical URL and the title of the thread', () => {
    expect(readThreadInfo(page)).toEqual({
      url: THREAD_URL,
      title: 'Aldric Pruebas ( CuentaFicticia01 )',
    });
  });

  it('names thread folders and page files', () => {
    expect(threadSlug(THREAD_URL)).toBe('aldric-pruebas-cuentaficticia01');
    expect(threadSlug('https://example.com/foro/topic/otro')).toBeUndefined();
    expect(pageFileName(3)).toBe('page-03.html');
    expect(pageNumberOf('page-03.html')).toBe(3);
    expect(pageNumberOf('posts.json')).toBeUndefined();
  });

  it('tells a logged-out answer from a thread page', () => {
    expect(isLoggedOutPage(THREAD_URL, '<p>Sorry, you cannot access this area.</p>')).toBe(true);
    expect(isLoggedOutPage('https://asgoria.com.ar/wp-login.php?redirect_to=x', '')).toBe(true);
    expect(isLoggedOutPage(THREAD_URL, page.documentElement.outerHTML)).toBe(false);
  });
});

describe('mergePosts', () => {
  const post = (number: number, page: number): ForumPost => ({
    number,
    page,
    authorName: 'Narradora Ficticia',
    authorHandle: 'narradora-ficticia',
    postedAt: null,
    html: '',
  });

  it('keeps one post per number, sorted by number', () => {
    const { posts: merged, duplicates } = mergePosts([
      [post(3, 2), post(1, 1)],
      [post(2, 1), post(3, 3)],
    ]);
    expect(merged.map(({ number, page }) => [number, page])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
    ]);
    expect(duplicates).toEqual([3]);
  });
});
