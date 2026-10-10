import { parseDocument, type ErrorCode } from 'yaml';

export type FrontmatterResult =
  | { ok: true; frontmatter: unknown; body: string }
  | { ok: false; error: string };

const OPENING = /^---[ \t]*(?:\n|$)/;
const BLOCK = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/;

const YAML_HINT =
  "revisa los dos puntos, las comillas y la sangría; si un valor contiene ':' o '#', ponlo entre comillas";

const YAML_ERRORS: Partial<Record<ErrorCode, string>> = {
  DUPLICATE_KEY: 'hay un campo repetido',
  BAD_INDENT: 'la sangría no es correcta',
  TAB_AS_INDENT: 'hay tabuladores en la sangría; usa espacios',
  MISSING_CHAR: 'falta cerrar unas comillas, un corchete o una llave',
};

/**
 * Splits a Markdown file into its YAML frontmatter and body.
 * Tolerates a leading BOM and CRLF line endings.
 */
export function splitFrontmatter(raw: string): FrontmatterResult {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  if (!OPENING.test(text)) {
    return {
      ok: false,
      error:
        "falta la cabecera: la ficha debe empezar por una línea con '---', seguida de los campos y de otra línea con '---'",
    };
  }

  const match = BLOCK.exec(text);
  if (!match) {
    return {
      ok: false,
      error: "la cabecera no está cerrada: falta la línea '---' que va después de los campos",
    };
  }

  const document = parseDocument(match[1] ?? '');
  const [firstError] = document.errors;
  if (firstError) {
    // linePos is 1-based inside the YAML block; +1 accounts for the opening '---'.
    const line = firstError.linePos?.[0].line;
    const where = line === undefined ? '' : ` en la línea ${line + 1}`;
    const reason = YAML_ERRORS[firstError.code] ?? 'el formato no es válido';
    return {
      ok: false,
      error: `la cabecera tiene un error${where}: ${reason}; ${YAML_HINT}`,
    };
  }

  return {
    ok: true,
    frontmatter: document.toJS(),
    body: text.slice(match[0].length).replace(/^\n+/, ''),
  };
}
