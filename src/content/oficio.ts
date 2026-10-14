import { normalize, slugify } from './normalize.ts';
import type { ContentIssue, Entry, EntryMeta, FrontmatterOf } from './types.ts';

/*
 * An oficio (Encantamiento, Herrería…) is a list of recipes in groups, written in its
 * frontmatter. What the view and the search need beyond that is derived here, at build time:
 * which components are crafted in the same oficio (their name, normalized, is the name of one
 * of its recipes) and which are base materials, which recipes ask for each one, and how many
 * base materials a recipe takes in all. Node-safe and pure.
 */

type OficioFields = FrontmatterOf<'oficio'>;

export interface Quantity {
  nombre: string;
  cantidad: number;
}

export interface RecipeComponent extends Quantity {
  /** Anchor of its recipe when it is crafted in this oficio; undefined for a base material. */
  recipe?: string;
}

export interface Recipe {
  /** Anchor of its card: 'r-piedra-dimensional'. */
  id: string;
  nombre: string;
  componentes: RecipeComponent[];
  notas?: string;
  /** Anchors of the recipes that ask for this one, in the order of the file. */
  usedIn: string[];
  /**
   * The base materials it takes in all: each crafted component broken down into its own
   * recipe, quantities multiplied, in the order they first come up.
   */
  totals: Quantity[];
  /** Set when breaking it down runs into a cycle; the breakdown stops there. */
  cyclic?: true;
}

export interface RecipeGroup {
  /** 'piedras-y-objetos', the value of ?grupo=. */
  id: string;
  nombre: string;
  recipes: Recipe[];
}

export interface BaseMaterial {
  nombre: string;
  /** Anchors of the recipes that ask for it, in the order of the file. */
  usedIn: string[];
}

/** What the browser knows of an oficio beyond its frontmatter. */
export interface OficioMeta {
  groups: RecipeGroup[];
  /** Every base material of the oficio, alphabetically. */
  materials: BaseMaterial[];
  /** How many different components are crafted in the oficio. */
  crafted: number;
}

export interface OficioDerivation {
  meta: OficioMeta;
  /** Repeated recipe names and cycles; in Spanish, for validate. */
  warnings: string[];
}

export function isOficio<E extends EntryMeta>(entry: E): entry is E & EntryMeta<'oficio'> {
  return entry.type === 'oficio';
}

/** 'Tinta  Sulfúrica ' and 'tinta sulfurica' are the same recipe. */
export function recipeKey(nombre: string): string {
  return normalize(nombre).replace(/\s+/g, ' ');
}

/** A recipe as a search result of its own: 'Encantamiento · Piedra dimensional'. */
export function recipeSearchTitle(oficioTitle: string, recipeName: string): string {
  return `${oficioTitle} · ${recipeName}`;
}

export function recipesOf(meta: OficioMeta): Recipe[] {
  return meta.groups.flatMap((group) => group.recipes);
}

// Spanish collation, ignoring case and accents.
const collator = new Intl.Collator('es', { sensitivity: 'base' });

interface Breakdown {
  totals: Quantity[];
  cyclic: boolean;
}

export function deriveOficio({ grupos }: Pick<OficioFields, 'grupos'>): OficioDerivation {
  const warnings: string[] = [];
  const flat = grupos.flatMap((grupo) =>
    grupo.recetas.map((receta) => ({ grupo: grupo.nombre, receta })),
  );
  const ids = uniqueIds(flat.map(({ receta }) => `r-${slugify(receta.nombre) || 'receta'}`));

  // A repeated name is warned about; components and links lead to the first recipe.
  const byKey = new Map<string, number>();
  flat.forEach(({ grupo, receta }, index) => {
    const key = recipeKey(receta.nombre);
    const first = byKey.get(key);
    if (first === undefined) {
      byKey.set(key, index);
      return;
    }
    const other = flat[first];
    warnings.push(
      `la receta '${receta.nombre}' (grupo '${grupo}') se llama igual que '${other.receta.nombre}' (grupo '${other.grupo}'); sus componentes enlazan a la primera`,
    );
  });
  const recipeOf = (nombre: string) => byKey.get(recipeKey(nombre));

  const usedIn = flat.map((): string[] => []);
  const edges = flat.map(({ receta }, index) =>
    receta.componentes.flatMap(({ nombre }) => {
      const target = recipeOf(nombre);
      if (target === undefined) return [];
      if (!usedIn[target].includes(ids[index])) usedIn[target].push(ids[index]);
      return [target];
    }),
  );

  for (const cycle of findCycles(edges)) {
    const names = [...cycle, cycle[0]].map((index) => flat[index].receta.nombre);
    warnings.push(
      `las recetas forman un ciclo (${names.join(' → ')}); su desglose en materiales base se corta ahí`,
    );
  }

  // Breakdowns already known; one without a cycle is the same whichever recipe asks for it.
  const memo = new Map<number, Breakdown>();
  const breakDown = (start: number): Breakdown => {
    const sums = new Map<string, Quantity>();
    let cyclic = false;
    const add = (nombre: string, cantidad: number) => {
      const key = recipeKey(nombre);
      const sum = sums.get(key);
      if (sum) sum.cantidad += cantidad;
      else sums.set(key, { nombre, cantidad });
    };
    const visit = (index: number, factor: number, path: ReadonlySet<number>) => {
      for (const { nombre, cantidad } of flat[index].receta.componentes) {
        const amount = factor * cantidad;
        const target = recipeOf(nombre);
        if (target === undefined || path.has(target)) {
          if (target !== undefined) cyclic = true;
          add(nombre, amount);
          continue;
        }
        const known = memo.get(target);
        if (known && !known.cyclic) {
          for (const total of known.totals) add(total.nombre, total.cantidad * amount);
        } else {
          visit(target, amount, new Set(path).add(target));
        }
      }
    };
    visit(start, 1, new Set([start]));
    const breakdown = { totals: [...sums.values()], cyclic };
    memo.set(start, breakdown);
    return breakdown;
  };

  const recipes = flat.map(({ receta }, index): Recipe => {
    const { totals, cyclic } = breakDown(index);
    return {
      id: ids[index],
      nombre: receta.nombre,
      componentes: receta.componentes.map(({ nombre, cantidad }) => {
        const target = recipeOf(nombre);
        return target === undefined ? { nombre, cantidad } : { nombre, cantidad, recipe: ids[target] };
      }),
      ...(receta.notas === undefined ? {} : { notas: receta.notas }),
      usedIn: usedIn[index],
      totals,
      ...(cyclic ? { cyclic: true as const } : {}),
    };
  });

  const groupIds = uniqueIds(grupos.map((grupo) => slugify(grupo.nombre) || 'grupo'));
  let next = 0;
  const groups = grupos.map((grupo, index) => ({
    id: groupIds[index],
    nombre: grupo.nombre,
    recipes: grupo.recetas.map(() => recipes[next++]),
  }));

  const materials = new Map<string, BaseMaterial>();
  const crafted = new Set<string>();
  for (const recipe of recipes) {
    for (const { nombre, recipe: target } of recipe.componentes) {
      const key = recipeKey(nombre);
      if (target) {
        crafted.add(key);
        continue;
      }
      const material = materials.get(key) ?? { nombre, usedIn: [] };
      materials.set(key, material);
      if (!material.usedIn.includes(recipe.id)) material.usedIn.push(recipe.id);
    }
  }

  return {
    meta: {
      groups,
      materials: [...materials.values()].sort((a, b) => collator.compare(a.nombre, b.nombre)),
      crafted: crafted.size,
    },
    warnings,
  };
}

/** The warnings of an oficio, for validate; nothing for any other type. */
export function oficioIssues(entry: Entry): ContentIssue[] {
  if (!isOficio(entry)) return [];
  return deriveOficio(entry.data).warnings.map((message) => ({
    path: entry.path,
    level: 'warning',
    field: 'grupos',
    message,
  }));
}

/**
 * Where an issue inside 'grupos' is, by the names the DM wrote: "grupo 'Tintas' › receta
 * 'Tinta sulfúrica' › componente 'Polvo de azufre'". Undefined for any other field.
 */
export function oficioIssueLocation(
  fields: Readonly<Record<string, unknown>>,
  path: readonly PropertyKey[],
): string | undefined {
  if (path[0] !== 'grupos') return undefined;
  const levels = [
    { list: 'grupos', label: 'grupo' },
    { list: 'recetas', label: 'receta' },
    { list: 'componentes', label: 'componente' },
  ];
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

/** 'r-x', 'r-x-2', 'r-x-3'… so two recipes (or groups) with the same slug keep apart. */
function uniqueIds(bases: readonly string[]): string[] {
  const used = new Set<string>();
  return bases.map((base) => {
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}

/** One cycle per loop of the graph (recipe → recipes of its components), as lists of nodes. */
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
        // The same loop found from another of its recipes is not warned twice.
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
