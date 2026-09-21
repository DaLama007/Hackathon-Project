import { useEffect, useRef, useState } from "react";

export interface MealNutrition {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface PlateAnalysis {
  description: string;
  foods: string[];
  nutrition: MealNutrition;
  missing: string[];
  tips: string;
  usedStub: boolean;
}

export interface MealLog {
  id: number;
  user_id: string;
  description: string;
  foods: string[];
  nutrition: MealNutrition;
  missing: string[];
  tips: string;
  used_stub: boolean;
  created_at: string;
}

export interface MealScanCopy {
  scan: string;
  scanHint: string;
  uploadPhoto: string;
  useCamera: string;
  stopCamera: string;
  capture: string;
  scanning: string;
  stubBanner: string;
  description: string;
  foods: string;
  nutrition: string;
  missing: string;
  tips: string;
  recentMeals: string;
  emptyMeals: string;
  cameraDenied: string;
  needPhoto: string;
  previewAlt: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  saved: string;
}

interface MealScanPanelProps {
  t: MealScanCopy;
  lang: "en" | "nl";
  userId: string;
  onError: (message: string | null) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export default function MealScanPanel({ t, lang, userId, onError }: MealScanPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState<PlateAnalysis | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function loadMeals() {
    const res = await fetch(`/api/meals?userId=${encodeURIComponent(userId)}`, {
      headers: { "X-User-Id": userId },
    });
    if (!res.ok) throw new Error(`GET /api/meals failed: ${res.status}`);
    const data = await res.json();
    setMeals(data.meals as MealLog[]);
  }

  useEffect(() => {
    loadMeals().catch((err) => {
      console.error(err);
      onError(err instanceof Error ? err.message : "Failed to load meals");
    });
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function runScan(dataUrl: string) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      onError(t.needPhoto);
      return;
    }
    setScanning(true);
    setSavedNote(null);
    onError(null);
    try {
      const res = await fetch("/api/meals/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          imageBase64: parsed.base64,
          mimeType: parsed.mimeType,
          lang,
          userId,
          save: true,
        }),
      });
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      const data = await res.json();
      setAnalysis(data.analysis as PlateAnalysis);
      setSavedNote(t.saved);
      await loadMeals();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function onFilePicked(file: File | null) {
    if (!file) return;
    stopCamera();
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreviewBroken(false);
      setPreviewUrl(dataUrl);
      await runScan(dataUrl);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not read image");
    }
  }

  async function startCamera() {
    onError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera denied", err);
      onError(t.cameraDenied);
      setCameraOn(false);
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || !cameraOn) {
      onError(t.needPhoto);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onError(t.needPhoto);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewBroken(false);
    setPreviewUrl(dataUrl);
    stopCamera();
    await runScan(dataUrl);
  }

  const nutrition = analysis?.nutrition;

  return (
    <section className="meal-scan" aria-label={t.scan}>
      <h2>{t.scan}</h2>
      <p className="hint">{t.scanHint}</p>

      <div className="scan-actions">
        <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
          {t.uploadPhoto}
        </button>
        <button type="button" className="ghost" onClick={() => (cameraOn ? stopCamera() : startCamera())}>
          {cameraOn ? t.stopCamera : t.useCamera}
        </button>
        {cameraOn && (
          <button type="button" className="primary inline" disabled={scanning} onClick={captureFromCamera}>
            {scanning ? t.scanning : t.capture}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={t.uploadPhoto}
        onChange={(e) => {
          void onFilePicked(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {cameraOn && (
        <div className="scan-preview live">
          <video ref={videoRef} playsInline muted autoPlay className="scan-video" />
        </div>
      )}

      {!cameraOn && previewUrl && (
        <div className="scan-preview">
          {previewBroken ? (
            <p className="empty">{t.needPhoto}</p>
          ) : (
            <img
              src={previewUrl}
              alt={t.previewAlt}
              className="scan-image"
              onError={() => setPreviewBroken(true)}
            />
          )}
        </div>
      )}

      {scanning && <p className="empty">{t.scanning}</p>}
      {analysis?.usedStub && <p className="banner">{t.stubBanner}</p>}
      {savedNote && <p className="banner ok">{savedNote}</p>}

      {analysis && (
        <div className="meal-result">
          <h3>{t.description}</h3>
          <p>{analysis.description}</p>

          {analysis.foods.length > 0 && (
            <>
              <h3>{t.foods}</h3>
              <p className="meta">{analysis.foods.join(", ")}</p>
            </>
          )}

          {nutrition && (
            <>
              <h3>{t.nutrition}</h3>
              <ul className="nutrition-grid">
                <li>
                  <strong>{nutrition.kcal}</strong>
                  <span>{t.kcal}</span>
                </li>
                <li>
                  <strong>{nutrition.protein_g}g</strong>
                  <span>{t.protein}</span>
                </li>
                <li>
                  <strong>{nutrition.carbs_g}g</strong>
                  <span>{t.carbs}</span>
                </li>
                <li>
                  <strong>{nutrition.fat_g}g</strong>
                  <span>{t.fat}</span>
                </li>
                <li>
                  <strong>{nutrition.fiber_g}g</strong>
                  <span>{t.fiber}</span>
                </li>
              </ul>
            </>
          )}

          <h3>{t.missing}</h3>
          {analysis.missing.length === 0 ? (
            <p className="meta">—</p>
          ) : (
            <ul className="gap-list">
              {analysis.missing.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          )}

          {analysis.tips && (
            <>
              <h3>{t.tips}</h3>
              <p>{analysis.tips}</p>
            </>
          )}
        </div>
      )}

      <div className="meal-history">
        <h3>{t.recentMeals}</h3>
        {meals.length === 0 ? (
          <p className="empty">{t.emptyMeals}</p>
        ) : (
          <ul className="meal-list">
            {meals.slice(0, 8).map((meal) => (
              <li key={meal.id}>
                <strong>{meal.description}</strong>
                <p className="meta">
                  {meal.created_at} · {meal.nutrition.kcal} {t.kcal}
                  {meal.missing.length ? ` · ${t.missing}: ${meal.missing.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
