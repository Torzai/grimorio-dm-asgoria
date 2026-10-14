import { indexOficio, recipesOf, type OficioMeta, type Quantity, type Recipe } from './oficio.ts';

/*
 * "¿Qué puedo fabricar?": given what the DM has (component key → units), which recipes of an
 * oficio can be made right away, which can be made by first crafting intermediates only from that
 * inventory, and which lack little. Pure, so the view recalculates it on every change.
 *
 * Making a recipe takes each component from the stock and, for what is short, makes it with an
 * available recipe that produces it: ceil(short / produce) fabrications, its own components taken
 * the same way and what is left over back into the stock. A unit is never used twice. When an
 * intermediate cannot be made, what is missing is the intermediate itself if nothing of the
 * inventory went into the attempt, or what its own recipe lacks if something did.
 */

/** Units of each component the DM has, by component key. */
export type Inventory = ReadonlyMap<string, number>;

/** One fabrication step: a recipe made so many times. */
export interface ChainStep {
  recipe: string;
  veces: number;
}

export interface CraftableNow {
  recipe: string;
  /** How many times in a row, with only what is in the inventory. */
  veces: number;
}

export interface CraftableChained {
  recipe: string;
  /** How many times in a row, crafting intermediates each time. */
  veces: number;
  /** Intermediates in the order they are made, then the recipe itself once. */
  steps: ChainStep[];
}

export interface AlmostCraftable {
  recipe: string;
  /** What is short, and how much, in the order it comes up. */
  missing: Quantity[];
}

export interface CraftOptions {
  ready: CraftableNow[];
  chained: CraftableChained[];
  almost: AlmostCraftable[];
}

/** "Te falta poco": at most this many different components missing. */
export const MAX_MISSING = 2;
/** The count of "×N veces" stops here. */
const MAX_TIMES = 99;

interface Attempt {
  stock: Map<string, number>;
  /** Intermediates made, in order. */
  steps: ChainStep[];
  missing: Map<string, number>;
  /** Some unit of the inventory went into it. */
  used: boolean;
}

function add(map: Map<string, number>, key: string, units: number) {
  map.set(key, (map.get(key) ?? 0) + units);
}

function sum(units: Iterable<number>): number {
  let result = 0;
  for (const value of units) result += value;
  return result;
}

/** Fewer different components missing, then fewer units. */
function isBetter(a: Attempt, b: Attempt): boolean {
  return (
    a.missing.size < b.missing.size ||
    (a.missing.size === b.missing.size && sum(a.missing.values()) < sum(b.missing.values()))
  );
}

export function whatCanICraft(meta: OficioMeta, inventory: Inventory): CraftOptions {
  const { recipes: byId, components } = indexOficio(meta);
  // Only available recipes are made, the intermediates too.
  const makersOf = (key: string): Recipe[] =>
    (components.get(key)?.producers ?? []).flatMap((id) => {
      const recipe = byId.get(id);
      return recipe?.disponible ? [recipe] : [];
    });

  /** Takes `units` of a component into the attempt: from the stock, then by making it. */
  const acquire = (key: string, units: number, attempt: Attempt, path: ReadonlySet<string>) => {
    const have = attempt.stock.get(key) ?? 0;
    const taken = Math.min(have, units);
    if (taken > 0) {
      attempt.stock.set(key, have - taken);
      attempt.used = true;
    }
    const short = units - taken;
    if (short === 0) return;

    // With several recipes, the first that works or else the one that lacks least.
    let best: Attempt | undefined;
    for (const recipe of path.has(key) ? [] : makersOf(key)) {
      const trial = make(recipe, short, attempt, path);
      if (!best || isBetter(trial, best)) best = trial;
      if (trial.missing.size === 0) break;
    }
    if (best && (best.missing.size === 0 || best.used)) {
      attempt.stock = best.stock;
      attempt.steps = best.steps;
      attempt.used ||= best.used;
      for (const [missingKey, missingUnits] of best.missing) {
        add(attempt.missing, missingKey, missingUnits);
      }
      return;
    }
    add(attempt.missing, key, short);
  };

  /**
   * A copy of the attempt after making `units` of the recipe's product; its `missing` and `used`
   * only tell about this fabrication.
   */
  const make = (recipe: Recipe, units: number, from: Attempt, path: ReadonlySet<string>) => {
    const trial: Attempt = {
      stock: new Map(from.stock),
      steps: [...from.steps],
      missing: new Map(),
      used: false,
    };
    const veces = Math.ceil(units / recipe.produce);
    const inner = new Set(path).add(recipe.producto.key);
    for (const { key, cantidad } of recipe.componentes) acquire(key, cantidad * veces, trial, inner);
    const left = veces * recipe.produce - units;
    if (left > 0) add(trial.stock, recipe.producto.key, left);
    trial.steps.push({ recipe: recipe.id, veces });
    return trial;
  };

  /** One fabrication of the recipe from this stock. */
  const attemptRecipe = (recipe: Recipe, stock: ReadonlyMap<string, number>): Attempt => {
    const attempt: Attempt = { stock: new Map(stock), steps: [], missing: new Map(), used: false };
    const path = new Set([recipe.producto.key]);
    for (const { key, cantidad } of recipe.componentes) acquire(key, cantidad, attempt, path);
    return attempt;
  };

  const start = new Map([...inventory].filter(([, units]) => units > 0));
  const options: CraftOptions = { ready: [], chained: [], almost: [] };

  for (const recipe of recipesOf(meta)) {
    const first = attemptRecipe(recipe, start);
    if (first.missing.size === 0) {
      if (!recipe.disponible) continue;
      if (first.steps.length === 0) {
        options.ready.push({ recipe: recipe.id, veces: directTimes(recipe, start) });
        continue;
      }
      let veces = 1;
      let stock = first.stock;
      while (veces < MAX_TIMES) {
        const again = attemptRecipe(recipe, stock);
        if (again.missing.size > 0) break;
        stock = again.stock;
        veces += 1;
      }
      options.chained.push({
        recipe: recipe.id,
        veces,
        steps: [...first.steps, { recipe: recipe.id, veces: 1 }],
      });
    } else if (first.missing.size <= MAX_MISSING && first.used) {
      options.almost.push({
        recipe: recipe.id,
        missing: [...first.missing].map(([key, cantidad]) => ({
          key,
          nombre: components.get(key)?.nombre ?? key,
          cantidad,
        })),
      });
    }
  }

  // Least missing first; the sort is stable, so the file order stays among equals.
  options.almost.sort(
    (a, b) =>
      a.missing.length - b.missing.length ||
      sum(a.missing.map(({ cantidad }) => cantidad)) - sum(b.missing.map(({ cantidad }) => cantidad)),
  );
  return options;
}

/** How many times the recipe can be made with only what the stock has of its components. */
function directTimes(recipe: Recipe, stock: ReadonlyMap<string, number>): number {
  const needs = new Map<string, number>();
  for (const { key, cantidad } of recipe.componentes) add(needs, key, cantidad);
  let times = MAX_TIMES;
  for (const [key, units] of needs) {
    times = Math.min(times, Math.floor((stock.get(key) ?? 0) / units));
  }
  return times;
}
