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
