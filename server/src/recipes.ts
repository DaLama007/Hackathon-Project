import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type DietTag = "vegetarian" | "vegan" | "halal";

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  searchTerm: string;
  optional: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  timeMinutes: number;
  dietTags: DietTag[];
  summary: string;
  steps: string[];
  ingredients: RecipeIngredient[];
}

export interface UserPrefs {
  vegetarian: boolean;
  vegan: boolean;
  halal: boolean;
}

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const recipes = JSON.parse(readFileSync(resolve(dataDir, "recipes.json"), "utf8")) as Recipe[];

export function listRecipes(prefs?: UserPrefs): Recipe[] {
  if (!prefs) return recipes;
  return recipes.filter((recipe) => recipeMatchesPrefs(recipe, prefs));
}

export function getRecipe(id: string): Recipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}

/** Hide recipes that conflict with active diet prefs. */
export function recipeMatchesPrefs(recipe: Recipe, prefs: UserPrefs): boolean {
  if (prefs.vegan && !recipe.dietTags.includes("vegan")) return false;
  if (prefs.vegetarian && !recipe.dietTags.includes("vegetarian") && !recipe.dietTags.includes("vegan")) {
    return false;
  }
  if (prefs.halal && !recipe.dietTags.includes("halal")) return false;
  return true;
}

export function uniqueIngredientSearchTerms(): string[] {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      counts.set(ingredient.searchTerm, (counts.get(ingredient.searchTerm) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);
}

export function productMatchesIngredient(productTitle: string, ingredient: RecipeIngredient): boolean {
  const title = productTitle.toLowerCase();
  const needles = [ingredient.searchTerm, ingredient.name]
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  return needles.some((needle) => {
    if (title.includes(needle)) return true;
    const words = needle.split(/\s+/).filter((word) => word.length >= 3);
    return words.length > 0 && words.every((word) => title.includes(word));
  });
}

export interface RecipeProductHit {
  recipe: Recipe;
  matchedIngredient: RecipeIngredient;
}

export function recipesUsingProduct(productTitle: string, prefs?: UserPrefs): RecipeProductHit[] {
  const hits: RecipeProductHit[] = [];
  for (const recipe of listRecipes(prefs)) {
    const matchedIngredient = recipe.ingredients.find((ingredient) =>
      productMatchesIngredient(productTitle, ingredient),
    );
    if (matchedIngredient) {
      hits.push({ recipe, matchedIngredient });
    }
  }
  return hits;
}
