import { matchesAll } from '@/content/highlight';
import { normalize, withoutApostrophes } from '@/content/normalize';
import type { OficioMeta, Recipe, RecipeGroup } from '@/content/oficio';

/** The filters of an oficio's view, as read from the URL (?q=&grupo=). */
export interface RecipeFilters {
  /** Normalized words of ?q=, all required, in the recipe's name or its components'. */
  terms: readonly string[];
  /** Id of the only group shown; every group when undefined. */
  group?: string;
}

export interface FilteredGroup {
  group: RecipeGroup;
  /** Its recipes that pass the filters, in the order of the file. */
  recipes: Recipe[];
}

const searchTexts = new WeakMap<Recipe, string>();

/** The recipe's name and its components', normalized as the query is. */
function searchTextOf(recipe: Recipe): string {
  let text = searchTexts.get(recipe);
  if (text === undefined) {
    const names = [recipe.nombre, ...recipe.componentes.map((componente) => componente.nombre)];
    text = normalize(withoutApostrophes(names.join('\n')));
    searchTexts.set(recipe, text);
  }
  return text;
}

/**
 * The groups with the recipes that pass the filters; groups left empty are left out. `keep` is
 * shown even when it doesn't pass them: it is the recipe a link points to.
 */
export function filterRecipes(
  meta: OficioMeta,
  { terms, group }: RecipeFilters,
  keep?: string,
): FilteredGroup[] {
  return meta.groups.flatMap((candidate) => {
    const recipes = candidate.recipes.filter(
      (recipe) =>
        recipe.id === keep ||
        ((!group || candidate.id === group) &&
          (terms.length === 0 || matchesAll(searchTextOf(recipe), terms))),
    );
    return recipes.length > 0 ? [{ group: candidate, recipes }] : [];
  });
}
