// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanPostHtml, repairImageUrl } from './clean-post';
import { parseHtml } from './html';
import { postToMarkdown } from './markdown';
import { extractPosts } from './thread-page';

const page = parseHtml(
  readFileSync(new URL('../__fixtures__/thread-page.html', import.meta.url), 'utf8'),
);
const [, dmPost, playerPost] = extractPosts(page, 1).posts;
const dm = postToMarkdown(dmPost.html);
const player = postToMarkdown(playerPost.html);
const paragraphs = (markdown: string) => markdown.split('\n\n');

describe('Discord pastes', () => {
  it('keep only the text of the messages, one paragraph per message', () => {
    expect(dm.discordPaste).toBe(true);
    expect(paragraphs(dm.markdown)).toEqual([
      'Aldric - Brunilda - Cedric',
      'Primer mensaje del pegado.',
      'Segundo mensaje con **negrita**.',
      'Tercer mensaje atrapado en un botón.',
    ]);
  });

  it('lose times, "(edited)" marks, buttons and Discord classes', () => {
    const { html } = cleanPostHtml(dmPost.html);
    expect(dm.markdown).not.toMatch(/1:20|AM\]|\(edited\)|Añadir reacción/);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<ol');
  });
});

describe('quotes', () => {
  it('turn a forum post pasted into another one into a quote headed by its author', () => {
    expect(player.markdown).toContain(
      '> **Otro Narrador escribió:**\n>\n> Crónica pegada de otro hilo.',
    );
  });

  it('head an Asgaros quote with its author instead of "Cita de … en …"', () => {
    expect(player.markdown).toContain(
      '> **Narradora Ficticia escribió:**\n>\n> Texto citado de la narradora.',
    );
    expect(player.markdown).not.toContain('Cita de');
    expect(player.quotes).toBe(2);
  });

  it('drop the forum chrome of the pasted post: signature, reactions, buttons, edit note', () => {
    expect(player.markdown).not.toMatch(
      /Firma del post pegado|thumbs|Click to report|Cita\b|Last edited|#7\b/,
    );
  });
});

describe('links and personal data', () => {
  it('removes a mailto link entirely, address included', () => {
    expect(player.markdown).toContain('Mi correo es y el de mi hermano');
    expect(player.markdown).not.toContain('mailto:');
    expect(player.droppedLinks).toContain('mailto');
  });

  it('replaces a loose email and an old Discord tag', () => {
    expect(player.markdown).toContain('el de mi hermano [email eliminado].');
    expect(player.markdown).toContain('Mi viejo usuario era [usuario eliminado].');
    expect(player.markdown).not.toMatch(/ficticio@example|jugador_viejo|#\d{4}\b/);
  });

  it('drops links to Discord and keeps the forum links', () => {
    expect(player.markdown).not.toMatch(/discord/i);
    expect(player.droppedLinks).toContain('discord');
    expect(player.markdown).toContain(
      'Ver <https://asgoria.com.ar/foro/topic/otra-trama/#postid-1> y a ' +
        '[@Otro-Narrador](https://asgoria.com.ar/foro/profile/otro-narrador/).',
    );
  });
});

describe('images', () => {
  it('become links to the original URL, repaired when the paste broke them', () => {
    expect(player.markdown).toContain('Releen el mapa: [Imagen](https://i.example.com/mapa.jpg)');
    expect(player.images.map(({ status }) => status)).toEqual(['repaired', 'unavailable']);
  });

  it('hosted on Discord become a note, since those links expire', () => {
    expect(player.markdown).toContain('_(imagen no disponible: enlace caducado)_');
  });

  it('are repaired only when the fix is obvious', () => {
    expect(repairImageUrl("//i.postimg.cc/33.jpg' border='0' alt='33'/></a>")).toEqual({
      url: 'https://i.postimg.cc/33.jpg',
      repaired: true,
    });
    expect(repairImageUrl('https://example.com/a.png')).toEqual({
      url: 'https://example.com/a.png',
      repaired: false,
    });
    expect(repairImageUrl('javascript:alert(1)')).toEqual({ repaired: false });
    expect(repairImageUrl('')).toEqual({ repaired: false });
  });
});

describe('text', () => {
  it('keeps lists, bold and italics, and drops empty paragraphs and edit marks', () => {
    expect(player.markdown).toContain('Lista a mano:  \n- primero  \n- segundo');
    expect(player.markdown).toContain('- Viñeta _real_');
    expect(player.markdown.endsWith('\n\nResumen copiado del chat.')).toBe(true);
    expect(player.markdown).not.toContain('(editado)');
    expect(player.markdown).not.toMatch(/\n{3,}|&nbsp;|<\/?[a-z]+[ >]/);
  });
});
