import { useEffect, useState } from "react";
import type { MealLog } from "./MealScanPanel";

export interface WeeklyReview {
  id: number;
  user_id: string;
  week_start: string;
  summary: string;
  missing: string[];
  meal_count: number;
  used_stub: boolean;
  created_at: string;
}

export interface WeeklyCopy {
  weekly: string;
  weeklyHint: string;
  refreshReview: string;
  refreshing: string;
  stubBanner: string;
  thisWeek: string;
  mealsThisWeek: string;
  commonGaps: string;
  noMealsWeek: string;
  pastReviews: string;
}

interface WeeklyReviewPanelProps {
  t: WeeklyCopy;
  lang: "en" | "nl";
  userId: string;
  onError: (message: string | null) => void;
}

export default function WeeklyReviewPanel({ t, lang, userId, onError }: WeeklyReviewPanelProps) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [history, setHistory] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadReview(refresh: boolean) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    onError(null);
    try {
      const qs = new URLSearchParams({
        userId,
        lang,
        ...(refresh ? { refresh: "1" } : {}),
      });
      const res = await fetch(`/api/meals/weekly-review?${qs}`, {
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) throw new Error(`Weekly review failed: ${res.status}`);
      const data = await res.json();
      setReview(data.review as WeeklyReview);
      setMeals((data.meals as MealLog[]) ?? []);
      setHistory((data.history as WeeklyReview[]) ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Weekly review failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadReview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lang]);

  if (loading && !review) {
    return <p className="empty">{t.refreshing}</p>;
  }

  return (
    <section className="weekly-review" aria-label={t.weekly}>
      <div className="list-header">
        <h2>{t.weekly}</h2>
        <button type="button" className="ghost" disabled={refreshing} onClick={() => loadReview(true)}>
          {refreshing ? t.refreshing : t.refreshReview}
        </button>
      </div>
      <p className="hint">{t.weeklyHint}</p>

      {review?.used_stub && <p className="banner">{t.stubBanner}</p>}

      {review && (
        <article className="week-card">
          <h3>
            {t.thisWeek} · {review.week_start}
          </h3>
          <p>{review.summary}</p>
          <p className="meta">
            {t.mealsThisWeek}: {review.meal_count}
          </p>
          <h4>{t.commonGaps}</h4>
          {review.missing.length === 0 ? (
            <p className="meta">—</p>
          ) : (
            <ul className="gap-list">
              {review.missing.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          )}
        </article>
      )}

      <h3>{t.mealsThisWeek}</h3>
      {meals.length === 0 ? (
        <p className="empty">{t.noMealsWeek}</p>
      ) : (
        <ul className="meal-list">
          {meals.map((meal) => (
            <li key={meal.id}>
              <strong>{meal.description}</strong>
              <p className="meta">
                {meal.created_at}
                {meal.missing.length ? ` · ${meal.missing.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {history.length > 1 && (
        <>
          <h3>{t.pastReviews}</h3>
          <ul className="meal-list">
            {history
              .filter((item) => item.id !== review?.id)
              .map((item) => (
                <li key={item.id}>
                  <strong>{item.week_start}</strong>
                  <p>{item.summary}</p>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
