// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { editorUrl } from './editor-link';

describe('editorUrl', () => {
  it('joins the repo root and the entry path', () => {
    expect(editorUrl('C:/code/grimorio', 'content/npc/ana.md')).toBe(
      'vscode://file/C:/code/grimorio/content/npc/ana.md',
    );
  });

  it('drops the leading slash of a POSIX root so the URL has a single one after "file"', () => {
    expect(editorUrl('/home/dm/grimorio', 'content/npc/ana.md')).toBe(
      'vscode://file/home/dm/grimorio/content/npc/ana.md',
    );
  });

  it('escapes spaces and accents', () => {
    expect(editorUrl('C:/Users/Ana/Mis cosas/Grimorio DM', 'content/npc/tobías.md')).toBe(
      'vscode://file/C:/Users/Ana/Mis%20cosas/Grimorio%20DM/content/npc/tob%C3%ADas.md',
    );
  });

  it('escapes the characters that would cut the path', () => {
    expect(editorUrl('C:/a#b/c?d', 'content/x.md')).toBe(
      'vscode://file/C:/a%23b/c%3Fd/content/x.md',
    );
  });

  it('ignores a trailing slash in the root', () => {
    expect(editorUrl('C:/code/grimorio/', 'content/x.md')).toBe(
      'vscode://file/C:/code/grimorio/content/x.md',
    );
  });
});
