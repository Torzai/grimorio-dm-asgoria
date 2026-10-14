import { matchesAll } from '@/content/highlight';
import {
  FAMILIES,
  searchable,
  type CatalogComponent,
  type FamilyId,
  type OficioMeta,
  type Recipe,
  type RecipeGroup,
} from '@/content/oficio';

/** The filters of the Recetas tab, as read from the URL (?q=&grupo=&nivel=). */
export interface RecipeFilters {
  /** Normalized words of ?q=, all required, in the recipe's name, product or components. */
  terms: readonly string[];
  /** Id of the only group shown. */
  group?: string;
  /** The only level shown. */
  level?: number;
}

export interface FilteredGroup {
  group: RecipeGroup;
  /** Its recipes that pass the filters, in the order of the file. */
  recipes: Recipe[];
}

const recipeTexts = new WeakMap<Recipe, string>();

function recipeText(recipe: Recipe): string {
  let text = recipeTexts.get(recipe);
  if (text === undefined) {
    const names = [
      recipe.nombre,
      recipe.producto.nombre,
      ...recipe.componentes.map((componente) => componente.nombre),
    ];
    text = searchable(names.join('\n'));
    recipeTexts.set(recipe, text);
  }
  return text;
}

/**
 * The groups with the recipes that pass the filters; groups left empty are left out. `keep` is
 * shown even when it doesn't pass them: it is the open recipe.
 */
export function filterRecipes(
  meta: OficioMeta,
  { terms, group, level }: RecipeFilters,
  keep?: string,
): FilteredGroup[] {
  return meta.groups.flatMap((candidate) => {
    const recipes = candidate.recipes.filter(
      (recipe) =>
        recipe.id === keep ||
        ((!group || candidate.id === group) &&
          (level === undefined || recipe.nivel === level) &&
          (terms.length === 0 || matchesAll(recipeText(recipe), terms))),
    );
    return recipes.length > 0 ? [{ group: candidate, recipes }] : [];
  });
}

/** Base materials, or what some recipe of the oficio makes. */
export const ORIGINS = ['base', 'fabricable'] as const;

export type Origin = (typeof ORIGINS)[number];

export function isOrigin(value: string | null): value is Origin {
  return ORIGINS.some((origin) => origin === value);
}

export function isFamily(value: string | null): value is FamilyId {
  return FAMILIES.some(({ id }) => id === value);
}

export function originOf(component: CatalogComponent): Origin {
  return component.producers.length > 0 ? 'fabricable' : 'base';
}

/** The filters of the Componentes tab, as read from the URL (?cq=&origen=&familia=). */
export interface ComponentFilters {
  terms: readonly string[];
  origin?: Origin;
  family?: FamilyId;
}

export interface FamilyGroup {
  family: FamilyId;
  label: string;
  components: CatalogComponent[];
}

const componentTexts = new WeakMap<CatalogComponent, string>();

function componentText(component: CatalogComponent): string {
  let text = componentTexts.get(component);
  if (text === undefined) {
    text = searchable(component.nombre);
    componentTexts.set(component, text);
  }
  return text;
}

/** The families with the components that pass the filters; `keep` is the open component. */
export function filterComponents(
  meta: OficioMeta,
  { terms, origin, family }: ComponentFilters,
  keep?: string,
): FamilyGroup[] {
  return FAMILIES.flatMap(({ id, label }) => {
    const components = meta.components.filter(
      (component) =>
        component.familia === id &&
        (component.key === keep ||
          ((!family || family === id) &&
            (!origin || originOf(component) === origin) &&
            (terms.length === 0 || matchesAll(componentText(component), terms)))),
    );
    return components.length > 0 ? [{ family: id, label, components }] : [];
  });
}

/** The components whose name has every word of the query, for the inventory's picker. */
export function matchComponents(meta: OficioMeta, terms: readonly string[]): CatalogComponent[] {
  if (terms.length === 0) return [];
  return meta.components.filter((component) => matchesAll(componentText(component), terms));
}
