/** Display translations for seeded Dutch recipe/ingredient names. AH searchTerms stay Dutch. */

export type Lang = "en" | "nl";

const recipeTitlesEn: Record<string, string> = {
  "linzen-dal": "Lentil dal with spinach",
  "kikkererwten-curry": "Chickpea curry",
  "zalm-broccoli": "Salmon with broccoli and potatoes",
  "kip-rijst-bak": "Chicken rice skillet with bell pepper",
  "pasta-pesto-tomaat": "Pesto pasta with cherry tomatoes",
  shakshuka: "Shakshuka",
  "tofu-roerbak": "Tofu stir-fry with vegetables",
  bonenschotel: "Mexican bean skillet",
  pompoensoep: "Creamy pumpkin soup",
  "falafel-wrap": "Falafel wrap with cucumber",
  paddenstoelenrisotto: "Mushroom risotto",
  "hutspot-gehakt": "Hutspot with minced beef",
  "zoete-aardappel-bowl": "Sweet potato bowl",
  "macaroni-gehakt": "Macaroni with minced beef",
  pannenkoeken: "Dutch pancakes",
  "nasi-goreng": "Nasi goreng with chicken",
};

const recipeSummariesEn: Record<string, string> = {
  "linzen-dal": "High-protein, budget weeknight dish with red lentils.",
  "kikkererwten-curry": "Creamy curry with chickpeas and coconut milk.",
  "zalm-broccoli": "Simple oven salmon with vegetables and baby potatoes.",
  "kip-rijst-bak": "Halal-friendly chicken with bell pepper and rice in one pan.",
  "pasta-pesto-tomaat": "Quick pasta with pesto, tomato, and mozzarella.",
  shakshuka: "Eggs in spiced tomato sauce — cheap and filling.",
  "tofu-roerbak": "Plant-based stir-fry with tofu, wok vegetables, and soy sauce.",
  bonenschotel: "Budget-friendly skillet with black beans and corn.",
  pompoensoep: "Sweet pumpkin soup with coconut milk — easy weeknight bowl.",
  "falafel-wrap": "Quick wraps with falafel, lettuce, and tahini dip.",
  paddenstoelenrisotto: "Creamy risotto with mushrooms and Parmesan.",
  "hutspot-gehakt": "Dutch mashed potato, carrot, and onion with spiced minced beef.",
  "zoete-aardappel-bowl": "Roasted sweet potato with chickpeas, quinoa, and avocado.",
  "macaroni-gehakt": "Classic macaroni in tomato sauce with minced beef — kid-friendly.",
  pannenkoeken: "Thin pancakes from flour, milk, and egg — sweet or savory.",
  "nasi-goreng": "Indonesian fried rice with chicken, vegetables, and ketjap.",
};

/** Ingredient display names (Dutch seed → English). Keys are lowercase. */
const ingredientNamesEn: Record<string, string> = {
  "rode linzen": "red lentils",
  spinazie: "spinach",
  ui: "onion",
  knoflook: "garlic",
  tomatenblokjes: "diced tomatoes",
  olijfolie: "olive oil",
  kurkuma: "turmeric",
  kikkererwten: "chickpeas",
  kokosmelk: "coconut milk",
  currypasta: "curry paste",
  basmatirijst: "basmati rice",
  zalmfilet: "salmon fillet",
  broccoli: "broccoli",
  krieltjes: "baby potatoes",
  citroen: "lemon",
  kipfilet: "chicken breast",
  paprika: "bell pepper",
  rijst: "rice",
  kippenbouillon: "chicken stock",
  pasta: "pasta",
  "groene pesto": "green pesto",
  cherrytomaten: "cherry tomatoes",
  mozzarella: "mozzarella",
  basilicum: "basil",
  eieren: "eggs",
  komijn: "cumin",
  tofu: "tofu",
  wokgroente: "stir-fry vegetables",
  sojasaus: "soy sauce",
  sesamolie: "sesame oil",
  "zwarte bonen": "black beans",
  mais: "corn",
  "tortilla's": "tortillas",
  avocados: "avocado",
  avocado: "avocado",
  pompoen: "pumpkin",
  groentebouillon: "vegetable stock",
  gember: "ginger",
  falafel: "falafel",
  wraps: "wraps",
  komkommer: "cucumber",
  ijsbergsla: "iceberg lettuce",
  tahin: "tahini",
  "risotto rijst": "risotto rice",
  champignons: "mushrooms",
  "parmezaanse kaas": "Parmesan cheese",
  boter: "butter",
  aardappelen: "potatoes",
  wortelen: "carrots",
  rundergehakt: "minced beef",
  melk: "milk",
  "zoete aardappel": "sweet potato",
  quinoa: "quinoa",
  macaroni: "macaroni",
  tomatensaus: "tomato sauce",
  "geraspte kaas": "grated cheese",
  bloem: "flour",
  stroop: "syrup",
  ketjap: "sweet soy sauce",
};

const unitsEn: Record<string, string> = {
  stuk: "pcs",
  teen: "clove",
  el: "tbsp",
  tl: "tsp",
  pot: "jar",
  bosje: "bunch",
  fles: "bottle",
};

export function recipeTitle(id: string, dutchTitle: string, lang: Lang): string {
  if (lang !== "en") return dutchTitle;
  return recipeTitlesEn[id] ?? dutchTitle;
}

export function recipeSummary(id: string, dutchSummary: string, lang: Lang): string {
  if (lang !== "en") return dutchSummary;
  return recipeSummariesEn[id] ?? dutchSummary;
}

export function ingredientName(dutchName: string, lang: Lang): string {
  if (lang !== "en") return dutchName;
  return ingredientNamesEn[dutchName.toLowerCase()] ?? dutchName;
}

export function ingredientUnit(dutchUnit: string, lang: Lang): string {
  if (lang !== "en") return dutchUnit;
  return unitsEn[dutchUnit.toLowerCase()] ?? dutchUnit;
}
