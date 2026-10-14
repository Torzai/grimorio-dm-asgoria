import { z } from 'zod';
import { ENTRY_TYPES, type EntryType } from './types.ts';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface IssueInput {
  input?: unknown;
}

/** Quotes back what the author wrote so the message points at the exact value. */
export function describeValue(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) return 'una lista';
  if (isObject(value)) return 'un bloque de campos';
  return String(value);
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function missing(field: string): string {
  return `falta el campo obligatorio '${field}'`;
}

/** Builds an error message: "missing" when absent, "must be <expected>" otherwise. */
function expected(subject: string, field: string, what: string) {
  return (issue: IssueInput): string =>
    issue.input === undefined
      ? missing(field)
      : `${subject} debe ser ${what}; has puesto ${describeValue(issue.input)}`;
}

const SLUG_HINT = "el nombre de fichero de otra ficha (sin '.md'), p. ej. 'gadelica'";
const LIST_HINT = 'una lista, p. ej. [uno, dos]';

function text(field: string) {
  return z
    .string({ error: expected(`'${field}'`, field, 'un texto') })
    .trim()
    .min(1, { error: `'${field}' no puede estar vacío` });
}

function textList(field: string) {
  return z.array(
    z.string({ error: expected(`cada elemento de '${field}'`, field, 'un texto') }),
    { error: expected(`'${field}'`, field, LIST_HINT) },
  );
}

function slug(subject: string, field: string) {
  const message = expected(subject, field, SLUG_HINT);
  return z.string({ error: message }).regex(SLUG_PATTERN, { error: message });
}

function slugList(field: string) {
  return z.array(slug(`cada elemento de '${field}'`, field), {
    error: expected(`'${field}'`, field, LIST_HINT),
  });
}

function tagList() {
  const message = expected(
    'cada tag',
    'tags',
    "una palabra en minúsculas, sin tildes y con guiones, p. ej. 'mercader-rico'",
  );
  return z.array(z.string({ error: message }).regex(SLUG_PATTERN, { error: message }), {
    error: expected("'tags'", 'tags', LIST_HINT),
  });
}

function integer(field: string, min: number) {
  const message = expected(`'${field}'`, field, 'un número entero');
  return z
    .number({ error: message })
    .int({ error: message })
    .min(min, { error: `'${field}' no puede ser menor que ${min}` });
}

function boolean(field: string) {
  return z.boolean({ error: expected(`'${field}'`, field, 'true o false') });
}

function oneOf<const T extends readonly [string, ...string[]]>(field: string, values: T) {
  return z.enum(values, {
    error: expected(`'${field}'`, field, `uno de estos valores: ${values.join(', ')}`),
  });
}

function isoDate(field: string) {
  return z.iso.date({
    error: expected(`'${field}'`, field, 'una fecha con formato AAAA-MM-DD, p. ej. 2026-03-14'),
  });
}

function webAddress(field: string) {
  return z.url({
    protocol: /^https?$/,
    error: expected(
      `'${field}'`,
      field,
      'una dirección web completa, p. ej. https://asgoria.com.ar/foro/topic/…',
    ),
  });
}

/**
 * A recipe of an oficio: what it is called, what it takes and what one fabrication gives
 * (`produce` units of `producto`, by default one of its own name).
 */
const recetaSchema = z.object(
  {
    nombre: text('nombre'),
    /** What it makes, when it is not called as the recipe ('Transmutar: Polvo de hueso'). */
    producto: text('producto').optional(),
    /** Units of the product per fabrication; 1 when missing. */
    produce: integer('produce', 1).optional(),
    nivel: integer('nivel', 1).optional(),
    dc: integer('dc', 1).optional(),
    /** false: listed in the manual but not craftable yet. */
    disponible: boolean('disponible').optional(),
    requisitos: text('requisitos').optional(),
    efecto: text('efecto').optional(),
    componentes: z
      .array(
        z.object(
          {
            nombre: text('nombre'),
            cantidad: integer('cantidad', 1),
            /** The manual's "(Cargado)": the component goes in charged. */
            cargado: boolean('cargado').optional(),
          },
          {
            error: expected(
              'cada componente',
              'componentes',
              'un bloque con nombre y cantidad, p. ej. { nombre: Agua, cantidad: 1 }',
            ),
          },
        ),
        { error: expected("'componentes'", 'componentes', LIST_HINT) },
      )
      .min(1, { error: 'no tiene componentes; pon al menos uno con su nombre y su cantidad' }),
    notas: text('notas').optional(),
  },
  { error: expected('cada receta', 'recetas', 'un bloque con nombre y componentes') },
);

/** A skill of an oficio's progression; `requiere` is the número of the skill it needs. */
const habilidadSchema = z.object(
  {
    numero: integer('numero', 1),
    nivel: integer('nivel', 1),
    nombre: text('nombre'),
    requiere: integer('requiere', 1).optional(),
    axp: integer('axp', 0).optional(),
    descripcion: text('descripcion'),
  },
  {
    error: expected(
      'cada habilidad',
      'habilidades',
      'un bloque con numero, nivel, nombre y descripcion',
    ),
  },
);

const grupoSchema = z.object(
  {
    nombre: text('nombre'),
    recetas: z.array(recetaSchema, { error: expected("'recetas'", 'recetas', LIST_HINT) }),
  },
  { error: expected('cada grupo', 'grupos', 'un bloque con nombre y recetas') },
);

export const PJ_ESTADOS = ['activo', 'inactivo', 'retirado', 'muerto'] as const;
const MAX_CLASES = 3;

const commonShape = {
  title: text('title'),
  aliases: textList('aliases').optional(),
  tags: tagList().optional(),
  resumen: text('resumen').optional(),
  zona: slug("'zona'", 'zona').optional(),
  relacionados: slugList('relacionados').optional(),
  actualizado: isoDate('actualizado').optional(),
};

/** What an entry brought from the forum by the importer carries (pj, cronica, lore). */
const importedShape = {
  /** When the entry was brought from the forum by the importer. */
  importado: isoDate('importado').optional(),
  /** false: the importer never touches this entry again. */
  importar: boolean('importar').optional(),
};

export const entrySchemas = {
  npc: z.object({
    type: z.literal('npc'),
    ...commonShape,
    faccion: text('faccion').optional(),
    raza: text('raza').optional(),
    clase: text('clase').optional(),
    ubicacion: text('ubicacion').optional(),
    tag_toolset: text('tag_toolset').optional(),
  }),
  pj: z.object({
    type: z.literal('pj'),
    ...commonShape,
    /** The player's NWN account: it identifies the PJ in the game. */
    cuenta_nwn: text('cuenta_nwn'),
    sexo: text('sexo').optional(),
    raza: text('raza').optional(),
    clases: textList('clases')
      .max(MAX_CLASES, { error: `'clases' admite como mucho ${MAX_CLASES} clases` })
      .optional(),
    /** Free text; pj.ts warns when it is not one of the 9 alignments. */
    alineamiento: text('alineamiento').optional(),
    deidad: text('deidad').optional(),
    estado: oneOf('estado', PJ_ESTADOS),
    /** The PJ's thread in the forum. */
    hilo: webAddress('hilo').optional(),
    ...importedShape,
  }),
  zona: z.object({
    type: z.literal('zona'),
    ...commonShape,
    region: text('region').optional(),
    mapa: text('mapa').optional(),
  }),
  lore: z.object({
    type: z.literal('lore'),
    ...commonShape,
    categoria: oneOf('categoria', [
      'historia',
      'faccion',
      'religion',
      'cultura',
      'cosmologia',
      'normas',
      'otro',
    ]),
    /**
     * The forum thread a lore entry comes from (scrape:topics): post #1 is its '## Contenido'
     * and the replies its annexes, as in a crónica.
     */
    hilo: webAddress('hilo').optional(),
    ...importedShape,
  }),
  cronica: z.object({
    type: z.literal('cronica'),
    ...commonShape,
    /** The forum thread the crónica comes from: post #1 is the situation, replies its annexes. */
    hilo: webAddress('hilo'),
    ...importedShape,
  }),
  varita: z.object({
    type: z.literal('varita'),
    ...commonShape,
    cargas: integer('cargas', 0).optional(),
    nivel_lanzador: integer('nivel_lanzador', 1).optional(),
    recarga: boolean('recarga').optional(),
    uso: text('uso').optional(),
  }),
  oficio: z.object({
    type: z.literal('oficio'),
    ...commonShape,
    /** Where the recipes come from: 'Manual de Encantamiento'. */
    fuente: text('fuente').optional(),
    /** The recipes, in groups; oficio.ts derives the components, their recipes and totals. */
    grupos: z.array(grupoSchema, { error: expected("'grupos'", 'grupos', LIST_HINT) }),
    habilidades: z
      .array(habilidadSchema, { error: expected("'habilidades'", 'habilidades', LIST_HINT) })
      .optional(),
  }),
  comando: z.object({
    type: z.literal('comando'),
    ...commonShape,
    sintaxis: text('sintaxis'),
    ejemplo: text('ejemplo').optional(),
    ambito: oneOf('ambito', ['jugador', 'dm']),
  }),
  herramienta: z.object({
    type: z.literal('herramienta'),
    ...commonShape,
    uso: text('uso').optional(),
    donde: text('donde').optional(),
  }),
  sesion: z.object({
    type: z.literal('sesion'),
    ...commonShape,
    fecha: isoDate('fecha'),
    narradores: textList('narradores').optional(),
    /** Slugs of the PJs that took part; links.ts links them both ways. */
    participantes: slugList('participantes').optional(),
  }),
} satisfies Record<EntryType, z.ZodObject>;

export const entryFrontmatterSchema = z.discriminatedUnion(
  'type',
  [
    entrySchemas.npc,
    entrySchemas.pj,
    entrySchemas.zona,
    entrySchemas.lore,
    entrySchemas.cronica,
    entrySchemas.varita,
    entrySchemas.oficio,
    entrySchemas.comando,
    entrySchemas.herramienta,
    entrySchemas.sesion,
  ],
  {
    error: (issue) => {
      // Zod passes the whole frontmatter object here, not just the 'type' value.
      const { input } = issue;
      const value = isObject(input) ? ('type' in input ? input.type : undefined) : input;
      return value === undefined
        ? missing('type')
        : `tipo desconocido ${describeValue(value)}; los tipos válidos son: ${ENTRY_TYPES.join(', ')}`;
    },
  },
);
