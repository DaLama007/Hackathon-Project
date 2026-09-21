import {
  insertMealLog,
  listMealLogs,
  upsertWeeklyReview,
  type MealLog,
  type MealNutrition,
  type WeeklyReview,
} from "./db.js";
import { chatCompletions, resolveLlmConfig } from "./llm.js";

export type MealLang = "en" | "nl";

export interface PlateAnalysis {
  description: string;
  foods: string[];
  nutrition: MealNutrition;
  missing: string[];
  tips: string;
  usedStub: boolean;
}

function stubAnalysis(lang: MealLang): PlateAnalysis {
  // TODO(demo): fake plate analysis when no OpenRouter/OpenAI key is set
  if (lang === "en") {
    return {
      description: "Plate with pasta in tomato sauce and a small side salad.",
      foods: ["pasta", "tomato sauce", "lettuce"],
      nutrition: { kcal: 520, protein_g: 18, carbs_g: 72, fat_g: 14, fiber_g: 6 },
      missing: ["fiber", "vegetables", "protein"],
      tips: "Add beans, extra greens, or yoghurt for more fiber and protein.",
      usedStub: true,
    };
  }
  return {
    description: "Bord met pasta in tomatensaus en een klein saladebijgerecht.",
    foods: ["pasta", "tomatensaus", "sla"],
    nutrition: { kcal: 520, protein_g: 18, carbs_g: 72, fat_g: 14, fiber_g: 6 },
    missing: ["vezels", "groenten", "eiwit"],
    tips: "Voeg peulvruchten, extra groente of yoghurt toe voor meer vezels en eiwit.",
    usedStub: true,
  };
}

function parseAnalysisJson(text: string): Omit<PlateAnalysis, "usedStub"> | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const nutrition = parsed.nutrition as Record<string, unknown> | undefined;
    if (!nutrition || typeof parsed.description !== "string") return null;
    return {
      description: parsed.description.trim(),
      foods: Array.isArray(parsed.foods) ? parsed.foods.map((f) => String(f)) : [],
      nutrition: {
        kcal: Number(nutrition.kcal) || 0,
        protein_g: Number(nutrition.protein_g) || 0,
        carbs_g: Number(nutrition.carbs_g) || 0,
        fat_g: Number(nutrition.fat_g) || 0,
        fiber_g: Number(nutrition.fiber_g) || 0,
      },
      missing: Array.isArray(parsed.missing) ? parsed.missing.map((m) => String(m)) : [],
      tips: typeof parsed.tips === "string" ? parsed.tips : "",
    };
  } catch (err) {
    console.warn("[meals] failed to parse model JSON:", err);
    return null;
  }
}

async function analyzeWithLlm(
  imageBase64: string,
  mimeType: string,
  lang: MealLang,
): Promise<Omit<PlateAnalysis, "usedStub">> {
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;
  const language = lang === "en" ? "English" : "Dutch";

  const content = await chatCompletions({
    temperature: 0.2,
    json: true,
    messages: [
      {
        role: "system",
        content:
          `You analyze a photo of a plate of food. Reply ONLY JSON in ${language}: ` +
          `{"description":"short","foods":["..."],"nutrition":{"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0},` +
          `"missing":["fiber|vegetables|protein|..."],"tips":"one short tip"}. ` +
          `Estimate roughly; list nutrients/food groups that look underrepresented vs a balanced meal.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this plate." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const parsed = parseAnalysisJson(content);
  if (!parsed) throw new Error("LLM returned unusable plate analysis");
  return parsed;
}

export async function analyzePlate(options: {
  imageBase64: string;
  mimeType?: string;
  lang?: MealLang;
}): Promise<PlateAnalysis> {
  const mimeType = options.mimeType?.trim() || "image/jpeg";
  const lang = options.lang === "en" ? "en" : "nl";

  if (resolveLlmConfig()) {
    try {
      const result = await analyzeWithLlm(options.imageBase64, mimeType, lang);
      return { ...result, usedStub: false };
    } catch (err) {
      console.warn("[meals] plate analysis failed, using stub:", err);
    }
  }

  return stubAnalysis(lang);
}

export function savePlateMeal(options: {
  userId: string;
  analysis: PlateAnalysis;
}): MealLog {
  return insertMealLog({
    userId: options.userId,
    description: options.analysis.description,
    foods: options.analysis.foods,
    nutrition: options.analysis.nutrition,
    missing: options.analysis.missing,
    tips: options.analysis.tips,
    usedStub: options.analysis.usedStub,
  });
}

/** Monday YYYY-MM-DD for the ISO-ish week containing `date`. */
export function weekStartMonday(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sqliteSinceFromWeekStart(weekStart: string): string {
  return `${weekStart} 00:00:00`;
}

/** Same gap logged in EN and NL should count once, not twice. */
const GAP_SYNONYMS: Record<string, { en: string; nl: string }> = {
  fiber: { en: "fiber", nl: "vezels" },
  fibre: { en: "fiber", nl: "vezels" },
  vezels: { en: "fiber", nl: "vezels" },
  protein: { en: "protein", nl: "eiwit" },
  proteins: { en: "protein", nl: "eiwit" },
  eiwit: { en: "protein", nl: "eiwit" },
  eiwitten: { en: "protein", nl: "eiwit" },
  vegetables: { en: "vegetables", nl: "groenten" },
  veggies: { en: "vegetables", nl: "groenten" },
  groente: { en: "vegetables", nl: "groenten" },
  groenten: { en: "vegetables", nl: "groenten" },
  fruit: { en: "fruit", nl: "fruit" },
  "whole grains": { en: "whole grains", nl: "volkoren granen" },
  wholegrains: { en: "whole grains", nl: "volkoren granen" },
  "volkoren granen": { en: "whole grains", nl: "volkoren granen" },
  volkoren: { en: "whole grains", nl: "volkoren granen" },
  calcium: { en: "calcium", nl: "calcium" },
  iron: { en: "iron", nl: "ijzer" },
  ijzer: { en: "iron", nl: "ijzer" },
  "healthy fats": { en: "healthy fats", nl: "gezonde vetten" },
  "gezonde vetten": { en: "healthy fats", nl: "gezonde vetten" },
};

function aggregateMissing(meals: MealLog[], lang: MealLang): string[] {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const meal of meals) {
    for (const gap of meal.missing) {
      const raw = gap.trim().toLowerCase();
      if (!raw) continue;
      const known = GAP_SYNONYMS[raw];
      const key = known ? known.en : raw;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      labels.set(key, known ? known[lang] : gap.trim());
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => labels.get(key) ?? key)
    .slice(0, 6);
}

function stubWeeklySummary(meals: MealLog[], missing: string[], lang: MealLang): string {
  // TODO(demo): weekly narrative from saved meal texts without an AI key
  const mealBits = meals
    .slice(0, 5)
    .map((m) => m.description)
    .join(lang === "en" ? "; " : "; ");
  const gaps = missing.length
    ? missing.join(", ")
    : lang === "en"
      ? "nothing major"
      : "niets opvallends";

  if (lang === "en") {
    return (
      `This week you logged ${meals.length} meal(s). ` +
      `Highlights: ${mealBits || "no descriptions yet"}. ` +
      `Often missing vs a balanced plate: ${gaps}. ` +
      `Aim for more fiber-rich sides and colorful vegetables next week.`
    );
  }
  return (
    `Deze week heb je ${meals.length} maaltijd(en) gelogd. ` +
    `Highlights: ${mealBits || "nog geen beschrijvingen"}. ` +
    `Vaak tekort t.o.v. een gebalanceerd bord: ${gaps}. ` +
    `Mik volgende week op meer vezelrijke bijgerechten en kleurrijke groente.`
  );
}

async function weeklySummaryWithLlm(
  meals: MealLog[],
  missing: string[],
  lang: MealLang,
): Promise<string> {
  const language = lang === "en" ? "English" : "Dutch";
  const mealLines = meals
    .map(
      (m) =>
        `- ${m.created_at}: ${m.description} | missing: ${m.missing.join(", ") || "—"} | ` +
        `kcal≈${m.nutrition.kcal}`,
    )
    .join("\n");

  return chatCompletions({
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          `Write a short weekly nutrition review in ${language} (4-6 sentences). ` +
          `Use the meal descriptions. Call out recurring gaps (fiber, veggies, protein, etc.). No medical claims.`,
      },
      {
        role: "user",
        content:
          `Recurring gaps: ${missing.join(", ") || "none"}\nMeals:\n${mealLines || "(none)"}`,
      },
    ],
  });
}

export async function buildWeeklyReview(options: {
  userId: string;
  lang?: MealLang;
  weekStart?: string;
}): Promise<WeeklyReview> {
  const lang = options.lang === "en" ? "en" : "nl";
  const weekStart = options.weekStart ?? weekStartMonday();
  const meals = listMealLogs(options.userId, sqliteSinceFromWeekStart(weekStart));
  const missing = aggregateMissing(meals, lang);

  let summary: string;
  let usedStub = true;
  if (resolveLlmConfig() && meals.length > 0) {
    try {
      summary = await weeklySummaryWithLlm(meals, missing, lang);
      usedStub = false;
    } catch (err) {
      console.warn("[meals] weekly review failed, using stub:", err);
      summary = stubWeeklySummary(meals, missing, lang);
    }
  } else {
    summary = stubWeeklySummary(meals, missing, lang);
  }

  return upsertWeeklyReview({
    userId: options.userId,
    weekStart,
    summary,
    missing,
    mealCount: meals.length,
    usedStub,
  });
}
