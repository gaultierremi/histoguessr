"use client";

import { useState } from "react";
import type { QuizQuestion, QuizDifficulty } from "@/lib/types";
import { createClient } from "@/lib/supabase-browser";
import { saveQuizScore } from "@/lib/scores";

// ─── Types & constants ────────────────────────────────────────────────────────

type McqMode = "cash" | "carre" | "duo";

const MODE_POINTS: Record<McqMode | "truefalse", number> = {
  cash:      300,
  carre:     200,
  duo:       100,
  truefalse: 150,
};

const MODE_LABELS: Record<McqMode | "truefalse", string> = {
  cash:      "Cash",
  carre:     "Carré",
  duo:       "Duo",
  truefalse: "Vrai / Faux",
};

type AnswerRecord = {
  question: QuizQuestion;
  mode: McqMode | "truefalse";
  playerAnswer: string;
  correct: boolean;
  pointsEarned: number;
  pointsPossible: number;
};

// ─── Cash validation ──────────────────────────────────────────────────────────

function isCashCorrect(player: string, correct: string): boolean {
  const ABBREVS: [RegExp, string][] = [
    [/\bste\b/g, "sainte"],
    [/\bst\b/g,  "saint"],
    [/\bdr\b/g,  "docteur"],
    [/\bmr\b/g,  "monsieur"],
    [/\bm\./g,   "monsieur"],
    [/\bjc\b/g,  "jesus christ"],
  ];

  function normalize(s: string): string {
    let r = s.toLowerCase().trim();
    // Remove diacritics (é→e, è→e, ç→c, etc.)
    r = r.normalize("NFD").replace(/[̀-ͯ]/g, "");
    // Expand common abbreviations before stripping punctuation
    for (const [pat, rep] of ABBREVS) r = r.replace(pat, rep);
    // Unify hyphens/dashes to space (jean-baptiste → jean baptiste)
    r = r.replace(/[-–—]/g, " ");
    // Strip non-alphanumeric
    r = r.replace(/[^a-z0-9\s]/g, " ");
    // Remove articles and stop-words
    r = r.replace(/\b(le|la|les|de|du|des|un|une|d|l)\b/g, " ");
    return r.replace(/\s+/g, " ").trim();
  }

  const p = normalize(player);
  const c = normalize(correct);

  // Rule 0: single letter (or empty) → never accepted
  if (!p || p.length < 2) return false;

  // Rule 1: exact match after full normalisation
  if (p === c) return true;

  // Rule 2: phrase containment in either direction — min 4 chars
  if (p.length >= 4 && (c.includes(p) || p.includes(c))) return true;

  // Rule 3: a significant word (≥4 chars) from the correct answer
  // must appear as a *complete word* in the player's answer
  const correctWords = c.split(/\s+/).filter((w) => w.length >= 4);
  const playerWords  = new Set(p.split(/\s+/));
  return correctWords.some((kw) => playerWords.has(kw));
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="text-sm tracking-widest text-amber-500">
      {"★".repeat(level)}
      <span className="text-white/20">{"★".repeat(3 - level)}</span>
    </span>
  );
}

// ─── Mode selector ────────────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (m: McqMode) => void }) {
  const modes: { id: McqMode; label: string; pts: number; desc: string }[] = [
    { id: "cash",  label: "Cash",  pts: 300, desc: "Réponse libre" },
    { id: "carre", label: "Carré", pts: 200, desc: "4 choix" },
    { id: "duo",   label: "Duo",   pts: 100, desc: "2 choix" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-center text-xs uppercase tracking-widest text-gray-500">
        Choisis ton mode
      </p>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="flex flex-col items-center gap-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-4 transition-all hover:border-amber-500/50 hover:bg-gray-800 active:scale-95"
          >
            <span className="text-base font-bold text-white">{m.label}</span>
            <span className="text-sm font-semibold text-amber-400">+{m.pts}</span>
            <span className="text-xs text-gray-500">{m.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  answers,
  difficulty,
}: {
  answers: AnswerRecord[];
  difficulty: QuizDifficulty;
}) {
  const score    = answers.reduce((s, r) => s + r.pointsEarned,   0);
  const maxScore = answers.reduce((s, r) => s + r.pointsPossible, 0);
  const correctCount = answers.filter((r) => r.correct).length;
  const total = answers.length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-sm uppercase tracking-widest text-gray-500">Score final</p>
        <p className="text-5xl font-bold text-white">
          {score}
          <span className="text-2xl text-gray-600"> / {maxScore}</span>
        </p>
        <p className="text-lg text-amber-500">
          {correctCount} bonne{correctCount > 1 ? "s" : ""} réponse
          {correctCount > 1 ? "s" : ""} sur {total}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {answers.map((rec, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1.5 rounded-xl border p-4 ${
              rec.correct
                ? "border-green-800 bg-green-950/40"
                : "border-red-900 bg-red-950/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-widest text-gray-500">Q{i + 1}</p>
                <span className="rounded-full border border-gray-700 px-1.5 py-0.5 text-xs text-gray-500">
                  {MODE_LABELS[rec.mode]}
                </span>
              </div>
              <span className={`text-sm font-bold ${rec.correct ? "text-green-400" : "text-red-400"}`}>
                {rec.correct ? `+${rec.pointsEarned}` : "+0"}
              </span>
            </div>
            <p className="text-sm leading-snug text-white/80">{rec.question.question}</p>
            <p className="text-sm text-gray-300">
              <span className="text-gray-500">Bonne réponse : </span>
              {rec.question.options[rec.question.answer_index]}
            </p>
            {!rec.correct && rec.playerAnswer && (
              <p className="text-xs text-gray-500">Votre réponse : {rec.playerAnswer}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center pb-4">
        <button
          onClick={() => (window.location.href = `/quiz?difficulty=${difficulty}`)}
          className="rounded-lg bg-amber-500 px-8 py-3 font-semibold text-gray-950 transition-colors hover:bg-amber-400"
        >
          Rejouer
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuizCard({
  questions,
  difficulty,
  onComplete,
}: {
  questions: QuizQuestion[];
  difficulty: QuizDifficulty;
  onComplete?: (score: number, maxScore: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  // Per-question ephemeral state
  const [mode, setMode]               = useState<McqMode | null>(null);
  const [answered, setAnswered]       = useState(false);
  const [isCorrect, setIsCorrect]     = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [cashInput, setCashInput]     = useState("");
  const [duoIndices, setDuoIndices]   = useState<[number, number] | null>(null);

  const total       = questions.length;
  const question    = questions[step];
  const sessionDone = answers.length === total;
  const isTrueFalse = question.type === "truefalse";

  const effectiveMode: McqMode | "truefalse" = isTrueFalse ? "truefalse" : (mode ?? "carre");
  const pointsPossible = MODE_POINTS[effectiveMode];

  // ── Mode selection ──────────────────────────────────────────────────────────

  function handleSelectMode(m: McqMode) {
    setMode(m);
    if (m === "duo") {
      const wrongs = question.options.map((_, i) => i).filter((i) => i !== question.answer_index);
      const wrong  = wrongs[Math.floor(Math.random() * wrongs.length)];
      const pair: [number, number] =
        Math.random() > 0.5
          ? [question.answer_index, wrong]
          : [wrong, question.answer_index];
      setDuoIndices(pair);
    }
  }

  // ── Answer handlers ─────────────────────────────────────────────────────────

  function handleClickOption(idx: number) {
    if (answered) return;
    setSelectedIndex(idx);
    setIsCorrect(idx === question.answer_index);
    setAnswered(true);
  }

  function handleCashSubmit() {
    if (!cashInput.trim() || answered) return;
    const correct = isCashCorrect(cashInput, question.options[question.answer_index]);
    setIsCorrect(correct);
    setAnswered(true);
  }

  // ── Advance ─────────────────────────────────────────────────────────────────

  function handleNext() {
    const playerAnswer =
      mode === "cash"
        ? cashInput
        : selectedIndex !== null
        ? question.options[selectedIndex]
        : "";

    const newRecord = {
      question,
      mode: effectiveMode,
      playerAnswer,
      correct: isCorrect,
      pointsEarned: isCorrect ? pointsPossible : 0,
      pointsPossible,
    };
    const newAnswers = [...answers, newRecord];
    setAnswers(newAnswers);

    if (step < total - 1) {
      setStep((s) => s + 1);
      setMode(null);
      setAnswered(false);
      setIsCorrect(false);
      setSelectedIndex(null);
      setCashInput("");
      setDuoIndices(null);
    } else if (onComplete) {
      const finalScore = newAnswers.reduce((s, r) => s + r.pointsEarned, 0);
      const finalMax   = newAnswers.reduce((s, r) => s + r.pointsPossible, 0);
      onComplete(finalScore, finalMax);
    } else {
      const finalScore = newAnswers.reduce((s, r) => s + r.pointsEarned, 0);
      const finalMax   = newAnswers.reduce((s, r) => s + r.pointsPossible, 0);
      createClient().auth.getUser().then(({ data }) => {
        if (data.user) {
          saveQuizScore(
            data.user.id,
            data.user.user_metadata?.full_name ?? data.user.email ?? "Joueur",
            difficulty,
            finalScore,
            finalMax
          ).catch(() => {});
        }
      });
    }
  }

  // ── Derived display data ────────────────────────────────────────────────────

  if (sessionDone) {
    if (onComplete) {
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">En attente de l&apos;adversaire…</p>
        </div>
      );
    }
    return <ResultsScreen answers={answers} difficulty={difficulty} />;
  }

  const displayIndices: number[] =
    isTrueFalse      ? [0, 1] :
    mode === "duo"   ? (duoIndices ?? []) :
    mode === "carre" ? question.options.map((_, i) => i) :
    [];

  const isTwoCol = isTrueFalse || mode === "duo";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-6">
      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-white">
            Q{step + 1}<span className="font-normal text-white/40"> / {total}</span>
          </span>
          {question.period && <span className="text-sm text-white/60">{question.period}</span>}
          <DifficultyStars level={question.difficulty} />
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 py-5">
        <p className="text-lg font-medium leading-snug text-white">{question.question}</p>
        {(mode !== null || isTrueFalse) && (
          <p className="mt-2 text-xs text-gray-500">
            Mode {MODE_LABELS[effectiveMode]} · {pointsPossible} pts possibles
          </p>
        )}
      </div>

      {/* Mode selector (MCQ only, before mode chosen) */}
      {!isTrueFalse && mode === null && !answered && (
        <ModeSelector onSelect={handleSelectMode} />
      )}

      {/* Answer input — before answering */}
      {(isTrueFalse || mode !== null) && !answered && (
        mode === "cash" ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCashSubmit()}
              placeholder="Votre réponse…"
              autoFocus
              className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleCashSubmit}
              disabled={!cashInput.trim()}
              className="shrink-0 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Valider
            </button>
          </div>
        ) : (
          <div className={`grid gap-3 ${isTwoCol ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
            {displayIndices.map((idx) => (
              <button
                key={idx}
                onClick={() => handleClickOption(idx)}
                className={`rounded-xl border border-gray-700 bg-gray-900 px-4 py-3.5 text-sm font-medium text-gray-200 transition-all hover:border-amber-500/50 hover:bg-gray-800 ${
                  isTwoCol ? "text-center" : "text-left"
                }`}
              >
                {!isTwoCol && (
                  <span className="mr-2 text-xs text-gray-500">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                )}
                {question.options[idx]}
              </button>
            ))}
          </div>
        )
      )}

      {/* Revealed options + feedback — after answering */}
      {answered && (
        <div className="flex flex-col gap-3">
          {/* Revealed option buttons (not for cash mode) */}
          {mode !== "cash" && (
            <div className={`grid gap-3 ${isTwoCol ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
              {displayIndices.map((idx) => {
                let cls = "border-gray-800 bg-gray-900/40 text-gray-600 opacity-40";
                if (idx === question.answer_index) cls = "border-green-500 bg-green-500/10 text-green-300";
                else if (idx === selectedIndex)    cls = "border-red-500 bg-red-500/10 text-red-300";
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border px-4 py-3.5 text-sm font-medium ${cls} ${isTwoCol ? "text-center" : "text-left"}`}
                  >
                    {!isTwoCol && (
                      <span className="mr-2 text-xs opacity-60">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                    )}
                    {question.options[idx]}
                  </div>
                );
              })}
            </div>
          )}

          {/* Feedback card */}
          <div
            className={`rounded-xl border p-4 ${
              isCorrect ? "border-green-800 bg-green-950/40" : "border-red-900 bg-red-950/40"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-base font-bold ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                  {isCorrect ? "Correct !" : "Pas tout à fait…"}
                </p>
                <p className={`text-sm ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                  {isCorrect ? `+${pointsPossible} pts` : "+0 pt"}
                </p>
                {!isCorrect && (
                  <p className="mt-1 text-xs text-white/50">
                    Bonne réponse :{" "}
                    <span className="text-white/70">
                      {question.options[question.answer_index]}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={handleNext}
                className="shrink-0 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400"
              >
                {step < total - 1 ? "Suivante →" : "Résultats →"}
              </button>
            </div>
            {question.explanation && (
              <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-white/70">
                {question.explanation}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
