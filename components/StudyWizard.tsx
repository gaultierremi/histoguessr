"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { QuizQuestion, QuizQuestionType } from "@/lib/types";

type Phase =
  | "source"
  | "loading"
  | "pdf-upload"
  | "manual-build"
  | "config"
  | "launching";

type ExtractedQuestion = {
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  period: string;
};

const PERIODS = [
  "Toutes les périodes",
  "Préhistoire",
  "Antiquité",
  "Moyen Âge",
  "Renaissance",
  "XVIe siècle",
  "XVIIe siècle",
  "XVIIIe siècle",
  "XIXe siècle",
  "XXe siècle",
  "XXIe siècle",
  "Autre",
];

function currentStep(phase: Phase): 1 | 2 | 3 {
  if (phase === "config") return 2;
  if (phase === "launching") return 3;
  return 1;
}

function mapExtracted(q: ExtractedQuestion, i: number): QuizQuestion {
  return {
    id: `pdf-${i}-${Date.now()}`,
    type: q.type as QuizQuestionType,
    question: q.question,
    options: q.options,
    answer_index: q.answer_index,
    explanation: q.explanation ?? null,
    period: q.period ?? null,
    difficulty: 1,
    status: "approved",
    rejection_reason: null,
    created_at: new Date().toISOString(),
  };
}

export default function StudyWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("source");
  const [sourceType, setSourceType] = useState<
    "mine" | "library" | "pdf" | "manual" | null
  >(null);
  const [rawPool, setRawPool] = useState<QuizQuestion[]>([]);
  const [count, setCount] = useState<5 | 10 | 20>(10);
  const [mode, setMode] = useState<"normal" | "adaptive">("normal");
  const [periodFilter, setPeriodFilter] = useState("Toutes les périodes");
  const [error, setError] = useState<string | null>(null);

  // Manual builder
  const [manualList, setManualList] = useState<QuizQuestion[]>([]);
  const [mqText, setMqText] = useState("");
  const [mqOptions, setMqOptions] = useState(["", "", "", ""]);
  const [mqCorrect, setMqCorrect] = useState(0);
  const [mqType, setMqType] = useState<"mcq" | "truefalse">("mcq");

  const step = currentStep(phase);

  const filteredPool =
    periodFilter === "Toutes les périodes"
      ? rawPool
      : rawPool.filter((q) => q.period === periodFilter);

  async function handleSelectSource(
    src: "mine" | "library" | "pdf" | "manual"
  ) {
    setError(null);
    setSourceType(src);

    if (src === "pdf") {
      setPhase("pdf-upload");
      return;
    }
    if (src === "manual") {
      setManualList([]);
      setPhase("manual-build");
      return;
    }

    setPhase("loading");
    try {
      const supabase = createClient();

      if (src === "mine") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Non connecté");

        const { data, error: err } = await supabase
          .from("teacher_questions")
          .select("*")
          .eq("user_id", user.id)
          .limit(200);

        if (err) throw new Error(err.message);

        const mapped = (
          (data ?? []) as {
            id: string;
            type: string;
            question: string;
            options: string[];
            answer_index: number;
            explanation: string | null;
            period: string | null;
            difficulty: number | null;
            created_at: string;
          }[]
        ).map((tq) => ({
          id: tq.id,
          type: tq.type as QuizQuestionType,
          question: tq.question,
          options: tq.options,
          answer_index: tq.answer_index,
          explanation: tq.explanation ?? null,
          period: tq.period ?? null,
          difficulty: ((tq.difficulty ?? 1) as 1 | 2 | 3),
          status: "approved" as const,
          rejection_reason: null,
          created_at: tq.created_at,
        }));

        if (mapped.length === 0)
          throw new Error(
            "Aucune question trouvée. Soumettez d'abord des questions via le mode Professeur."
          );

        setRawPool(mapped);
      } else {
        const { data, error: err } = await supabase
          .from("quiz_questions")
          .select("*")
          .eq("status", "approved")
          .limit(300);

        if (err) throw new Error(err.message);
        if (!data?.length)
          throw new Error("Aucune question disponible dans la bibliothèque.");

        setRawPool(data as QuizQuestion[]);
      }

      setPhase("config");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setPhase("source");
    }
  }

  async function handlePdfFile(file: File) {
    setError(null);
    setPhase("loading");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64 }),
      });

      const json = (await res.json()) as {
        questions?: ExtractedQuestion[];
        error?: string;
      };
      if (json.error) throw new Error(json.error);
      if (!json.questions?.length)
        throw new Error("Aucune question extraite du PDF.");

      setRawPool(json.questions.map((q, i) => mapExtracted(q, i)));
      setPhase("config");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur extraction PDF");
      setPhase("pdf-upload");
    }
  }

  function handleAddManual() {
    const opts =
      mqType === "truefalse"
        ? ["Vrai", "Faux"]
        : mqOptions.filter((o) => o.trim());
    if (!mqText.trim() || opts.length < 2) return;

    setManualList((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.random()}`,
        type: mqType,
        question: mqText.trim(),
        options: opts,
        answer_index: Math.min(mqCorrect, opts.length - 1),
        explanation: null,
        period: null,
        difficulty: 1,
        status: "approved",
        rejection_reason: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setMqText("");
    setMqOptions(["", "", "", ""]);
    setMqCorrect(0);
  }

  function handleManualDone() {
    if (manualList.length === 0) return;
    setRawPool(manualList);
    setPhase("config");
  }

  async function handleLaunch() {
    setError(null);
    setPhase("launching");

    try {
      let finalQuestions: QuizQuestion[];

      if (mode === "adaptive") {
        const res = await fetch(`/api/adaptive-questions?count=${count}`);
        if (!res.ok) throw new Error("Erreur chargement adaptatif");
        const json = (await res.json()) as { questions?: QuizQuestion[] };
        finalQuestions = json.questions ?? [];
        if (finalQuestions.length === 0)
          throw new Error(
            "Aucune question adaptative disponible. Jouez d'abord quelques parties en mode Quiz."
          );
      } else {
        const pool = filteredPool;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        finalQuestions = shuffled.slice(0, count);
        if (finalQuestions.length === 0)
          throw new Error("Aucune question avec ces critères.");
      }

      sessionStorage.setItem(
        "study_session",
        JSON.stringify({ questions: finalQuestions, source: sourceType, mode, count })
      );

      router.push("/study/session");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lancement");
      setPhase("config");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const stepLabels = ["Source", "Configurer", "Lancer"];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      {/* Step progress */}
      <div className="flex items-center">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-colors ${
                    done
                      ? "bg-purple-600 text-white"
                      : active
                        ? "bg-purple-500 text-white"
                        : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {done ? "✓" : n}
                </div>
                <span
                  className={`text-xs font-medium ${
                    active
                      ? "text-purple-400"
                      : done
                        ? "text-purple-600"
                        : "text-gray-600"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={`mb-4 h-px flex-1 mx-2 ${done ? "bg-purple-600" : "bg-gray-800"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ─── Phase: source ───────────────────────────────────────────────────── */}
      {phase === "source" && (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-xl font-black text-white">
              Choisir la source
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              D&apos;où viennent tes questions ?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "mine" as const,
                emoji: "📚",
                label: "Mes questions",
                desc: "Vos soumissions approuvées",
              },
              {
                id: "library" as const,
                emoji: "🌍",
                label: "Bibliothèque",
                desc: "Quiz HistoGuess validés",
              },
              {
                id: "pdf" as const,
                emoji: "📄",
                label: "Uploader un PDF",
                desc: "Extraction par Claude",
              },
              {
                id: "manual" as const,
                emoji: "✍️",
                label: "Créer manuellement",
                desc: "Écrire vos propres questions",
              },
            ].map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => handleSelectSource(src.id)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-gray-700 bg-gray-900 p-4 text-left transition-all hover:border-purple-500/50 hover:bg-gray-800 active:scale-[0.98]"
              >
                <span className="text-2xl">{src.emoji}</span>
                <div>
                  <p className="text-sm font-black text-white">{src.label}</p>
                  <p className="text-xs text-gray-500">{src.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Phase: loading ───────────────────────────────────────────────────── */}
      {(phase === "loading" || phase === "launching") && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-sm text-gray-400">
            {phase === "launching"
              ? "Préparation de ta session…"
              : "Chargement des questions…"}
          </p>
        </div>
      )}

      {/* ─── Phase: pdf-upload ────────────────────────────────────────────────── */}
      {phase === "pdf-upload" && (
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-xl font-black text-white">Uploader un PDF</h2>
            <p className="mt-1 text-sm text-gray-500">
              Claude extraira automatiquement les questions
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePdfFile(f);
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-700 p-10 text-center transition hover:border-purple-500/50 hover:bg-gray-900"
          >
            <span className="text-4xl">📄</span>
            <div>
              <p className="font-bold text-white">Cliquer pour choisir un PDF</p>
              <p className="mt-1 text-xs text-gray-500">Format PDF uniquement</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPhase("source")}
            className="text-center text-sm text-gray-600 transition hover:text-gray-400"
          >
            ← Retour
          </button>
        </div>
      )}

      {/* ─── Phase: manual-build ──────────────────────────────────────────────── */}
      {phase === "manual-build" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white">
                Créer les questions
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {manualList.length} question{manualList.length > 1 ? "s" : ""}{" "}
                ajoutée{manualList.length > 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("source")}
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              ← Retour
            </button>
          </div>

          <div className="flex gap-2">
            {(["mcq", "truefalse"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setMqType(t);
                  setMqCorrect(0);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mqType === t
                    ? "bg-purple-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {t === "mcq" ? "QCM" : "Vrai / Faux"}
              </button>
            ))}
          </div>

          <textarea
            value={mqText}
            onChange={(e) => setMqText(e.target.value)}
            placeholder="Énoncé de la question…"
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
          />

          {mqType === "mcq" && (
            <div className="flex flex-col gap-2">
              {mqOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={mqCorrect === i}
                    onChange={() => setMqCorrect(i)}
                    className="accent-purple-500"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const copy = [...mqOptions];
                      copy[i] = e.target.value;
                      setMqOptions(copy);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              ))}
              <p className="text-xs text-gray-600">● = bonne réponse</p>
            </div>
          )}

          {mqType === "truefalse" && (
            <div className="flex gap-4">
              {["Vrai", "Faux"].map((opt, i) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="tfcorrect"
                    checked={mqCorrect === i}
                    onChange={() => setMqCorrect(i)}
                    className="accent-purple-500"
                  />
                  <span className="text-sm text-gray-300">{opt}</span>
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddManual}
            disabled={
              !mqText.trim() ||
              (mqType === "mcq" &&
                mqOptions.filter((o) => o.trim()).length < 2)
            }
            className="rounded-xl border border-purple-500/50 bg-purple-500/10 py-2.5 text-sm font-bold text-purple-300 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-30"
          >
            + Ajouter cette question
          </button>

          {manualList.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                Questions ajoutées
              </p>
              {manualList.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2"
                >
                  <span className="flex-1 truncate text-sm text-gray-300">
                    {i + 1}. {q.question}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setManualList((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="shrink-0 text-xs text-red-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleManualDone}
            disabled={manualList.length === 0}
            className="rounded-xl bg-purple-600 py-3 font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Terminer ({manualList.length} question
            {manualList.length > 1 ? "s" : ""}) →
          </button>
        </div>
      )}

      {/* ─── Phase: config ────────────────────────────────────────────────────── */}
      {phase === "config" && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-black text-white">
              Configurer la session
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {rawPool.length} question{rawPool.length > 1 ? "s" : ""}{" "}
              disponible{rawPool.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Count */}
          <div>
            <p className="mb-2 text-sm font-black text-gray-400">
              Nombre de questions
            </p>
            <div className="flex gap-2">
              {([5, 10, 20] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-xl py-3 text-sm font-black transition ${
                    count === n
                      ? "bg-purple-600 text-white"
                      : "border border-gray-700 text-gray-400 hover:border-purple-500/50 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Mode (hidden for manual source) */}
          {sourceType !== "manual" && (
            <div>
              <p className="mb-2 text-sm font-black text-gray-400">Mode</p>
              <div className="flex gap-2">
                {(
                  [
                    { id: "normal", label: "Normal", desc: "Aléatoire" },
                    { id: "adaptive", label: "🧠 Adaptatif", desc: "Selon tes lacunes" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex flex-1 flex-col items-center rounded-xl py-3 text-sm font-black transition ${
                      mode === m.id
                        ? "bg-purple-600 text-white"
                        : "border border-gray-700 text-gray-400 hover:border-purple-500/50 hover:text-white"
                    }`}
                  >
                    {m.label}
                    <span className="mt-0.5 text-[10px] font-normal opacity-70">
                      {m.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Period filter (normal mode only) */}
          {mode === "normal" && sourceType !== "manual" && (
            <div>
              <p className="mb-2 text-sm font-black text-gray-400">
                Période historique
              </p>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-600">
                {filteredPool.length} question
                {filteredPool.length > 1 ? "s" : ""} correspond
                {filteredPool.length > 1 ? "ent" : ""} à ce filtre
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPhase("source")}
              className="rounded-xl border border-gray-700 px-5 py-3 text-sm font-bold text-gray-400 transition hover:text-white"
            >
              ← Retour
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={mode === "normal" && filteredPool.length === 0}
              className="flex-1 rounded-xl bg-purple-600 py-3 font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Lancer la session →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
