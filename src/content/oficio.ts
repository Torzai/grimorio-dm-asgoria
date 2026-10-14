import { normalize, slugify, withoutApostrophes } from './normalize.ts';
import type { SubDocument } from './search-index.ts';
import type { ContentIssue, Entry, EntryMeta, FrontmatterOf } from './types.ts';

/*
 * An oficio (Encantamiento, Herrería…) is a list of recipes in groups and, optionally, the skills
 * of its progression, written in its frontmatter. What the views and the search need beyond that
 * is derived here, at build time: the catalog of components (every name a recipe asks for or
 * makes, with its family, the recipes that make it and the ones that use it) and what one
 * fabrication of each recipe takes in base materials. Node-safe and pure; the browser reuses it
 * (oficio-craft.ts works on the same data).
 */

type OficioFields = FrontmatterOf<'oficio'>;
export type Habilidad = NonNullable<OficioFields['habilidades']>[number];

/** A component and how many of it: 'Polvo de hueso ×3'. */
export interface Quantity {
  /** componentKey() of its name: the value of ?c= and the key of the catalog. */
  key: string;
  nombre: string;
  cantidad: number;
}

export interface RecipeComponent extends Quantity {
  /** The manual's "(Cargado)": it goes in charged. */
  cargado?: true;
  /** Some recipe of the oficio makes it. */
  crafted?: true;
}

/** An intermediate made on the way to a recipe. */
export interface CraftStep {
  /** Id of the recipe made. */
  recipe: string;
  /** Fabrications: ceil(units needed / units per fabrication). */
  veces: number;
  /** Units of its product left over: veces × produce − needed. */
  sobrante: number;
}

/** What one fabrication of a recipe takes in base materials, making what is crafted. */
export interface BaseTotals {
  /** Base materials, in the order they come up. */
  base: Quantity[];
  /** Intermediates, in the order they are made: ingredients before what uses them. */
  steps: CraftStep[];
  /** Keys of the intermediates with more than one recipe: the first one is used. */
  alternatives: string[];
  /** Set when the breakdown runs into a cycle; what closes it counts as a base material. */
  cyclic?: true;
}

export interface Recipe {
  /** Slug of its name: the value of ?r=. */
  id: string;
  nombre: string;
  /** Id of its group. */
  group: string;
  /** What it makes: a component named as the recipe unless `producto` says otherwise. */
  producto: { key: string; nombre: string };
  /** Units of the product per fabrication. */
  produce: number;
  nivel?: number;
  dc?: number;
  /** false for a recipe of the manual that cannot be made yet. */
  disponible: boolean;
  requisitos?: string;
  efecto?: string;
  notas?: string;
  componentes: RecipeComponent[];
  totals: BaseTotals;
}

export interface RecipeGroup {
  /** 'transmutaciones', the value of ?grupo=. */
  id: string;
  nombre: string;
  recipes: Recipe[];
}

/** Families of the component library, in the order they are shown. */
export const FAMILIES = [
  { id: 'polvos', label: 'Polvos' },
  { id: 'gemas', label: 'Gemas y minerales' },
  { id: 'runas', label: 'Runas' },
  { id: 'tintas', label: 'Tintas' },
  { id: 'pergaminos', label: 'Pergaminos y círculos' },
  { id: 'restos', label: 'Virutas y restos' },
  { id: 'rituales', label: 'Rituales' },
  { id: 'otros', label: 'Otros' },
] as const;

export type FamilyId = (typeof FAMILIES)[number]['id'];

const FAMILY_IDS: readonly FamilyId[] = FAMILIES.map(({ id }) => id);

/**
 * The family of a component, by how its name starts (normalized, words only); the first that
 * matches wins and anything else is 'otros'.
 */
const FAMILY_PATTERNS: readonly (readonly [FamilyId, RegExp])[] = [
  ['rituales', /^ritual\b/],
  ['runas', /^runa\b/],
  ['tintas', /^tinta\b/],
  ['pergaminos', /^(rollo|pergamino|circulo|sello|encantamiento runico)\b/],
  ['polvos', /^polvo\b/],
  ['restos', /^(viruta|virutas|resto|restos|hueso|huesos)\b/],
  [
    'gemas',
    /^(mineral|guijarro|sal|sales|gema|cristal|piedra de azufre|piedra elemental|amatista|aventurina|cuarzo|granate|alejandrita|citrino|topacio|aguamarina|aquamarina|perla|jadeita|zafiro|opalo|diamante|fenalopa|espato|lapislazuli|lapizlazuli|rubi|esmeralda|obsidiana|onix|ambar)\b/,
  ],
];

export function familyOf(nombre: string): FamilyId {
  const words = componentKey(nombre).replace(/-/g, ' ');
  return FAMILY_PATTERNS.find(([, pattern]) => pattern.test(words))?.[0] ?? 'otros';
}

export function familyLabel(id: FamilyId): string {
  return FAMILIES.find((family) => family.id === id)?.label ?? id;
}

/** A recipe that asks for a component, and how many. */
export interface ComponentUse {
  recipe: string;
  cantidad: number;
  cargado?: true;
}

export interface CatalogComponent {
  key: string;
  /** As the recipe that makes it calls it, or as it is first written. */
  nombre: string;
  familia: FamilyId;
  /** Ids of the recipes that make it, in file order; none for a base material. */
  producers: string[];
  /** Every recipe that asks for it, in file order. */
  usedIn: ComponentUse[];
}

/** What the browser knows of an oficio beyond its frontmatter. */
export interface OficioMeta {
  groups: RecipeGroup[];
  /** Every component, by family (in FAMILIES order) and then alphabetically. */
  components: CatalogComponent[];
  /** The levels of its recipes, ascending. */
  levels: number[];
  /** Its skills by level and number; with a repeated number, only the first. */
  skills: Habilidad[];
}

interface OficioWarning {
  field: 'grupos' | 'habilidades';
  /** In Spanish, for validate. */
  message: string;
}

export interface OficioDerivation {
  meta: OficioMeta;
  warnings: OficioWarning[];
}

export function isOficio<E extends EntryMeta>(entry: E): entry is E & EntryMeta<'oficio'> {
  return entry.type === 'oficio';
}

/**
 * 'Runa: Berkana', 'runa berkana' and 'Runa  Berkána' are the same component: 'runa-berkana'.
 * Recipes are linked to their components by it.
 */
export function componentKey(nombre: string): string {
  return slugify(withoutApostrophes(nombre)) || 'componente';
}

/** A part of an oficio as a search result of its own: 'Encantamiento · Piedra dimensional'. */
export function oficioItemTitle(oficioTitle: string, name: string): string {
  return `${oficioTitle} · ${name}`;
}

export function recipesOf(meta: OficioMeta): Recipe[] {
  return meta.groups.flatMap((group) => group.recipes);
}

// Spanish collation, ignoring case and accents.
const collator = new Intl.Collator('es', { sensitivity: 'base' });

interface CatalogItem {
  key: string;
  nombre: string;
  /** Indexes of the recipes that make it. */
  producers: number[];
  usedIn: { recipe: number; cantidad: number; cargado?: true }[];
}

export function deriveOficio({
  grupos,
  habilidades = [],
}: Pick<OficioFields, 'grupos' | 'habilidades'>): OficioDerivation {
  const warnings: OficioWarning[] = [];
  const flat = grupos.flatMap((grupo, groupIndex) =>
    grupo.recetas.map((receta) => ({ grupo, groupIndex, receta })),
  );
  const ids = uniqueIds(flat.map(({ receta }) => slugify(receta.nombre) || 'receta'));
  const groupIds = uniqueIds(grupos.map((grupo) => slugify(grupo.nombre) || 'grupo'));

  const byName = new Map<string, number>();
  flat.forEach(({ grupo, receta }, index) => {
    const key = componentKey(receta.nombre);
    const first = byName.get(key);
    if (first === undefined) {
      byName.set(key, index);
      return;
    }
    const other = flat[first];
    warnings.push({
      field: 'grupos',
      message: `la receta '${receta.nombre}' (grupo '${grupo.nombre}') se llama igual que '${other.receta.nombre}' (grupo '${other.grupo.nombre}'); ponles nombres distintos para distinguirlas`,
    });
  });

  // Products first, so a component is named as the recipe that makes it calls it.
  const catalog = new Map<string, CatalogItem>();
  const itemOf = (nombre: string): CatalogItem => {
    const key = componentKey(nombre);
    let item = catalog.get(key);
    if (!item) catalog.set(key, (item = { key, nombre: nombre.trim(), producers: [], usedIn: [] }));
    return item;
  };
  const productKeys = flat.map(({ receta }, index) => {
    const item = itemOf(receta.producto ?? receta.nombre);
    item.producers.push(index);
    return item.key;
  });
  const components = flat.map(({ receta }, index) =>
    receta.componentes.map(({ nombre, cantidad, cargado }) => {
      const item = itemOf(nombre);
      const last = item.usedIn.at(-1);
      // The same component twice in a recipe is one use, with both quantities.
      if (last?.recipe === index) last.cantidad += cantidad;
      else item.usedIn.push({ recipe: index, cantidad, ...(cargado ? { cargado: true } : {}) });
      return { key: item.key, cantidad };
    }),
  );
  const produceOf = flat.map(({ receta }) => receta.produce ?? 1);
  const producersOf = (key: string) => catalog.get(key)?.producers ?? [];
  const nameOf = (key: string) => catalog.get(key)?.nombre ?? key;

  const edges = components.map((list) => list.flatMap(({ key }) => producersOf(key)));
  for (const cycle of findCycles(edges)) {
    const names = [...cycle, cycle[0]].map((index) => flat[index].receta.nombre);
    warnings.push({
      field: 'grupos',
      message: `las recetas forman un ciclo (${names.join(' → ')}); su desglose en materiales base se corta ahí`,
    });
  }

  /**
   * One fabrication of a recipe in base materials. Each intermediate is made once for all that
   * asks for it (its fabrications are ceil(needed / produce)), so it is processed after every
   * recipe above it: in reverse postorder of the graph, with the first recipe of each.
   */
  const totalsOf = (root: number): BaseTotals => {
    const rootKey = productKeys[root];
    const seen = new Set([rootKey]);
    const postorder: string[] = [];
    const visit = (key: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      const [producer] = producersOf(key);
      if (producer === undefined) return;
      for (const component of components[producer]) visit(component.key);
      postorder.push(key);
    };
    for (const component of components[root]) visit(component.key);

    // What is still to be made or found, in the order it comes up.
    const pending = new Map<string, number>();
    const cut = new Map<string, number>();
    const done = new Set([rootKey]);
    const need = (key: string, cantidad: number) => {
      // Already made, or the root itself: only a cycle asks for it again.
      const target = done.has(key) ? cut : pending;
      target.set(key, (target.get(key) ?? 0) + cantidad);
    };
    for (const { key, cantidad } of components[root]) need(key, cantidad);

    const steps: CraftStep[] = [];
    for (const key of [...postorder].reverse()) {
      const needed = pending.get(key) ?? 0;
      pending.delete(key);
      done.add(key);
      const [producer] = producersOf(key);
      if (needed === 0 || producer === undefined) continue;
      const veces = Math.ceil(needed / produceOf[producer]);
      steps.push({ recipe: ids[producer], veces, sobrante: veces * produceOf[producer] - needed });
      for (const component of components[producer]) need(component.key, component.cantidad * veces);
    }

    return {
      base: [...pending, ...cut].map(([key, cantidad]) => ({ key, nombre: nameOf(key), cantidad })),
      steps: steps.reverse(),
      alternatives: postorder.filter((key) => producersOf(key).length > 1),
      ...(cut.size > 0 ? { cyclic: true as const } : {}),
    };
  };

  const recipes = flat.map(({ receta, groupIndex }, index): Recipe => {
    const { requisitos, efecto, notas, nivel, dc } = receta;
    return {
      id: ids[index],
      nombre: receta.nombre,
      group: groupIds[groupIndex],
      producto: { key: productKeys[index], nombre: nameOf(productKeys[index]) },
      produce: produceOf[index],
      ...(nivel === undefined ? {} : { nivel }),
      ...(dc === undefined ? {} : { dc }),
      disponible: receta.disponible ?? true,
      ...(requisitos === undefined ? {} : { requisitos }),
      ...(efecto === undefined ? {} : { efecto }),
      ...(notas === undefined ? {} : { notas }),
      componentes: receta.componentes.map(({ nombre, cantidad, cargado }, position) => {
        const { key } = components[index][position];
        return {
          key,
          nombre,
          cantidad,
          ...(cargado ? { cargado: true as const } : {}),
          ...(producersOf(key).length > 0 ? { crafted: true as const } : {}),
        };
      }),
      totals: totalsOf(index),
    };
  });

  let next = 0;
  const groups = grupos.map((grupo, index) => ({
    id: groupIds[index],
    nombre: grupo.nombre,
    recipes: grupo.recetas.map(() => recipes[next++]),
  }));

  const library = [...catalog.values()]
    .map(
      ({ key, nombre, producers, usedIn }): CatalogComponent => ({
        key,
        nombre,
        familia: familyOf(nombre),
        producers: producers.map((index) => ids[index]),
        usedIn: usedIn.map((use) => ({ ...use, recipe: ids[use.recipe] })),
      }),
    )
    .sort(
      (a, b) =>
        FAMILY_IDS.indexOf(a.familia) - FAMILY_IDS.indexOf(b.familia) ||
        collator.compare(a.nombre, b.nombre),
    );

  const levels = [
    ...new Set(flat.flatMap(({ receta }) => (receta.nivel === undefined ? [] : [receta.nivel]))),
  ].sort((a, b) => a - b);

  const { skills, warnings: skillWarnings } = checkSkills(habilidades);
  warnings.push(...skillWarnings.map((message) => ({ field: 'habilidades' as const, message })));

  return { meta: { groups, components: library, levels, skills }, warnings };
}

/**
 * The skills by level and number, and what is wrong with them: a repeated number (the first
 * wins), a `requiere` that is no skill, and skills that require each other in a loop.
 */
function checkSkills(habilidades: readonly Habilidad[]): {
  skills: Habilidad[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byNumber = new Map<number, Habilidad>();
  for (const habilidad of habilidades) {
    const first = byNumber.get(habilidad.numero);
    if (first) {
      warnings.push(
        `las habilidades '${first.nombre}' y '${habilidad.nombre}' tienen el mismo número (${habilidad.numero}); solo cuenta la primera`,
      );
    } else {
      byNumber.set(habilidad.numero, habilidad);
    }
  }
  const skills = [...byNumber.values()];
  const indexOf = new Map(skills.map(({ numero }, index) => [numero, index]));
  for (const { numero, nombre, requiere } of skills) {
    if (requiere !== undefined && !indexOf.has(requiere)) {
      warnings.push(
        `la habilidad ${numero} ('${nombre}') requiere la habilidad ${requiere}, que no existe`,
      );
    }
  }
  const edges = skills.map(({ requiere }) => {
    const target = requiere === undefined ? undefined : indexOf.get(requiere);
    return target === undefined ? [] : [target];
  });
  for (const cycle of findCycles(edges)) {
    const names = [...cycle, cycle[0]].map((index) => `${skills[index].numero} '${skills[index].nombre}'`);
    warnings.push(`las habilidades se requieren en círculo (${names.join(' → ')})`);
  }
  return {
    skills: skills.sort((a, b) => a.nivel - b.nivel || a.numero - b.numero),
    warnings,
  };
}

/** The warnings of an oficio, for validate; nothing for any other type. */
export function oficioIssues(entry: Entry): ContentIssue[] {
  if (!isOficio(entry)) return [];
  return deriveOficio(entry.data).warnings.map(({ field, message }) => ({
    path: entry.path,
    level: 'warning',
    field,
    message,
  }));
}

/* Lookups for the browser, built once per oficio. */

export interface OficioIndex {
  recipes: ReadonlyMap<string, Recipe>;
  components: ReadonlyMap<string, CatalogComponent>;
  skills: ReadonlyMap<number, Habilidad>;
  groups: ReadonlyMap<string, RecipeGroup>;
}

const indexes = new WeakMap<OficioMeta, OficioIndex>();

export function indexOficio(meta: OficioMeta): OficioIndex {
  let index = indexes.get(meta);
  if (!index) {
    index = {
      recipes: new Map(recipesOf(meta).map((recipe) => [recipe.id, recipe])),
      components: new Map(meta.components.map((component) => [component.key, component])),
      skills: new Map(meta.skills.map((skill) => [skill.numero, skill])),
      groups: new Map(meta.groups.map((group) => [group.id, group])),
    };
    indexes.set(meta, index);
  }
  return index;
}

/* The view's tabs and where a search result inside an oficio opens. */

/** The tabs of an oficio's view, as values of ?tab=; the first is the default. */
export const OFICIO_TABS = ['recetas', 'componentes', 'fabricar', 'habilidades'] as const;

export type OficioTab = (typeof OFICIO_TABS)[number];

export function isOficioTab(value: string | null): value is OficioTab {
  return OFICIO_TABS.some((tab) => tab === value);
}

/**
 * The parts of an oficio that are search results of their own, by the prefix of their anchor:
 * the tab they open and the parameter that selects them there.
 */
const ANCHOR_KINDS = [
  { prefix: 'r-', kind: 'receta', tab: 'recetas', param: 'r' },
  { prefix: 'c-', kind: 'componente', tab: 'componentes', param: 'c' },
  { prefix: 'h-', kind: 'habilidad', tab: 'habilidades', param: 'h' },
] as const;

type AnchorKind = (typeof ANCHOR_KINDS)[number];

export type OficioItemKind = AnchorKind['kind'];

export interface OficioTarget {
  kind: OficioItemKind;
  tab: OficioTab;
  param: AnchorKind['param'];
  /** The id, key or number of the part. */
  value: string;
}

/** 'c-polvo-de-zafiro' → the component 'polvo-de-zafiro' in the tab Componentes. */
export function parseOficioAnchor(anchor: string): OficioTarget | undefined {
  const found = ANCHOR_KINDS.find(({ prefix }) => anchor.startsWith(prefix));
  const value = found && anchor.slice(found.prefix.length);
  return found && value ? { kind: found.kind, tab: found.tab, param: found.param, value } : undefined;
}

/** '?tab=componentes&c=polvo-de-zafiro': the query that opens a part found by the search. */
export function oficioAnchorSearch(anchor: string): string | undefined {
  const target = parseOficioAnchor(anchor);
  if (!target) return undefined;
  return `?${new URLSearchParams({ tab: target.tab, [target.param]: target.value })}`;
}

/** Each recipe, component and skill as a search result: 'Encantamiento · Polvo de zafiro'. */
export function oficioSearchParts(oficioTitle: string, meta: OficioMeta): SubDocument[] {
  const title = (name: string) => oficioItemTitle(oficioTitle, name);
  return [
    ...recipesOf(meta).map(
      (recipe): SubDocument => ({
        kind: 'section',
        anchor: `r-${recipe.id}`,
        title: title(recipe.nombre),
        // Its components weigh as its text, not as a resumen: a component's exact name finds
        // the component first, then the recipes that ask for it.
        body: [
          ...recipe.componentes.map((componente) => componente.nombre),
          recipe.requisitos,
          recipe.efecto,
          recipe.notas,
        ]
          .filter(Boolean)
          .join('\n'),
      }),
    ),
    ...meta.components.map(
      (component): SubDocument => ({
        kind: 'section',
        anchor: `c-${component.key}`,
        title: title(component.nombre),
        // Its name again, so that searching it puts the component above the recipes that
        // carry the same words ('Polvo de zafiro' over 'Transmutar: Polvo de zafiro').
        resumen: `${component.nombre} · ${familyLabel(component.familia)}`,
        body: '',
      }),
    ),
    ...meta.skills.map(
      (skill): SubDocument => ({
        kind: 'section',
        anchor: `h-${skill.numero}`,
        title: title(skill.nombre),
        resumen: `Nivel ${skill.nivel}`,
        body: skill.descripcion,
      }),
    ),
  ];
}

/**
 * Where an issue inside 'grupos' or 'habilidades' is, by the names the DM wrote: "grupo 'Tintas'
 * › receta 'Tinta sulfúrica' › componente 'Polvo de azufre'", "habilidad 'Tintas refinadas'".
 * Undefined for any other field.
 */
export function oficioIssueLocation(
  fields: Readonly<Record<string, unknown>>,
  path: readonly PropertyKey[],
): string | undefined {
  const levels =
    path[0] === 'grupos'
      ? [
          { list: 'grupos', label: 'grupo' },
          { list: 'recetas', label: 'receta' },
          { list: 'componentes', label: 'componente' },
        ]
      : path[0] === 'habilidades'
        ? [{ list: 'habilidades', label: 'habilidad' }]
        : [];
  const parts: string[] = [];
  let container: unknown = fields;
  for (const [depth, { list, label }] of levels.entries()) {
    const [key, position] = path.slice(depth * 2, depth * 2 + 2);
    if (key !== list || typeof position !== 'number') break;
    const items = isRecord(container) ? container[list] : undefined;
    const item: unknown = Array.isArray(items) ? items[position] : undefined;
    const nombre = isRecord(item) ? item.nombre : undefined;
    parts.push(
      typeof nombre === 'string' && nombre.trim()
        ? `${label} '${nombre.trim()}'`
        : `${label} nº ${position + 1}`,
    );
    container = item;
  }
  return parts.length > 0 ? parts.join(' › ') : undefined;
}

/** Accents, case and apostrophes aside, as the filters of the view compare names. */
export function searchable(text: string): string {
  return normalize(withoutApostrophes(text));
}

/** 'x', 'x-2', 'x-3'… so two recipes (or groups) with the same slug keep apart. */
function uniqueIds(bases: readonly string[]): string[] {
  const used = new Set<string>();
  return bases.map((base) => {
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}

/** One cycle per loop of a graph given as the targets of each node, as lists of nodes. */
function findCycles(edges: readonly (readonly number[])[]): number[][] {
  const NEW = 0;
  const OPEN = 1;
  const DONE = 2;
  const state = edges.map(() => NEW);
  const stack: number[] = [];
  const seen = new Set<string>();
  const cycles: number[][] = [];
  const visit = (node: number) => {
    state[node] = OPEN;
    stack.push(node);
    for (const target of edges[node]) {
      if (state[target] === OPEN) {
        const cycle = stack.slice(stack.indexOf(target));
        // The same loop found from another of its nodes is not warned twice.
        const start = cycle.indexOf(Math.min(...cycle));
        const key = [...cycle.slice(start), ...cycle.slice(0, start)].join(',');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (state[target] === NEW) {
        visit(target);
      }
    }
    stack.pop();
    state[node] = DONE;
  };
  edges.forEach((_, node) => {
    if (state[node] === NEW) visit(node);
  });
  return cycles;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
