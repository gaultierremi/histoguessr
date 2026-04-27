"use client";

import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";
import { createDuel, joinDuel, submitDuelAnswers, getDuelQuestions } from "@/lib/duel";
import QuizCard from "@/components/QuizCard";
import type { Duel, QuizDifficulty, QuizQuestion } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type LobbyStep =
  | "setup"
  | "waiting"
  | "countdown"
  | "playing"
  | "submitting"
  | "results";

const DIFF_CONFIG: { value: QuizDifficulty; label: string; stars: number }[] = [
  { value: 1, label: "Débutant", stars: 1 },
  { value: 2, label: "Pro",      stars: 2 },
  { value: 3, label: "Expert",   stars: 3 },
];

// ─── Small UI helpers ───────────────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-widest text-amber-400">
      {"★".repeat(n)}
      <span className="text-gray-700">{"★".repeat(3 - n)}</span>
    </span>
  );
}

function Spinner() {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
  );
}

// ─── Setup view ─────────────────────────────────────────────────────────────────

function SetupView({
  onHost,
  onJoin,
}: {
  onHost: (difficulty: QuizDifficulty) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
}) {
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(1);
  const [code, setCode]             = useState("");
  const [tab, setTab]               = useState<"host" | "join">("host");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleHost() {
    setLoading(true);
    setError(null);
    try { await onHost(difficulty); }
    catch (e) { setError((e as Error).message); setLoading(false); }
  }

  async function handleJoin() {
    if (code.length !== 4) return;
    setLoading(true);
    setError(null);
    try { await onJoin(code); }
    catch (e) { setError((e as Error).message); setLoading(false); }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-16">
      <div className="text-center">
        <span className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
          Mode Duel
        </span>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
          Défie un ami
        </h1>
        <p className="mt-2 text-gray-400">10 questions, même temps, meilleur score gagne</p>
      </div>

      {/* Tab switcher */}
      <div className="flex w-full rounded-xl border border-gray-800 bg-gray-900 p-1">
        {(["host", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
              tab === t
                ? "bg-amber-500 text-gray-950"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "host" ? "Créer un salon" : "Rejoindre"}
          </button>
        ))}
      </div>

      {tab === "host" ? (
        <div className="flex w-full flex-col gap-4">
          <p className="text-sm text-gray-500">Niveau de difficulté</p>
          <div className="flex flex-col gap-2">
            {DIFF_CONFIG.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                  difficulty === d.value
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <Stars n={d.stars} />
                <span className={`font-semibold ${difficulty === d.value ? "text-white" : "text-gray-300"}`}>
                  {d.label}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={handleHost}
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? <Spinner /> : "Créer le salon"}
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <p className="text-sm text-gray-500">Code du salon (4 chiffres)</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-center text-3xl font-bold tracking-[0.5em] text-white placeholder-gray-700 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={code.length !== 4 || loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner /> : "Rejoindre"}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <a href="/" className="text-sm text-gray-600 transition-colors hover:text-gray-400">
        ← Retour à l&apos;accueil
      </a>
    </div>
  );
}

// ─── Waiting view ───────────────────────────────────────────────────────────────

function WaitingView({ code, isHost }: { code: string; isHost: boolean }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-gray-400">
          {isHost ? "En attente d'un adversaire…" : "Connexion en cours…"}
        </p>
      </div>
      {isHost && (
        <>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-gray-500">Code du salon</p>
            <button
              onClick={copy}
              className="rounded-2xl border border-gray-700 bg-gray-900 px-8 py-5 text-5xl font-black tracking-[0.3em] text-white transition-colors hover:border-amber-500/50"
            >
              {code}
            </button>
            <p className="text-xs text-gray-600">{copied ? "Copié !" : "Cliquer pour copier"}</p>
          </div>
          <p className="text-sm text-gray-500">Partage ce code avec ton adversaire</p>
        </>
      )}
    </div>
  );
}

// ─── Countdown view ─────────────────────────────────────────────────────────────

function CountdownView({ count }: { count: number }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-xs uppercase tracking-widest text-gray-500">Début dans…</p>
      <p className="text-8xl font-black text-amber-400">{count}</p>
    </div>
  );
}

// ─── Results view ───────────────────────────────────────────────────────────────

function ResultsView({
  duel,
  isHost,
  onReplay,
}: {
  duel: Duel;
  isHost: boolean;
  onReplay: () => void;
}) {
  const myScore    = isHost ? duel.host_score! : duel.guest_score!;
  const theirScore = isHost ? duel.guest_score! : duel.host_score!;
  const myName     = isHost ? duel.host_name  : (duel.guest_name ?? "Adversaire");
  const theirName  = isHost ? (duel.guest_name ?? "Adversaire") : duel.host_name;

  const iWon   = myScore > theirScore;
  const isTied = myScore === theirScore;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-16 text-center">
      <p className="text-xs uppercase tracking-widest text-gray-500">Résultats du duel</p>

      <p className={`text-3xl font-black ${isTied ? "text-gray-300" : iWon ? "text-amber-400" : "text-gray-400"}`}>
        {isTied ? "Égalité !" : iWon ? "Tu as gagné !" : "Tu as perdu…"}
      </p>

      <div className="grid w-full grid-cols-2 gap-4">
        {[
          { name: myName,    score: myScore,    crown: iWon },
          { name: theirName, score: theirScore, crown: !iWon && !isTied },
        ].map((p, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-5 ${
              p.crown
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-gray-800 bg-gray-900"
            }`}
          >
            {p.crown && <span className="text-xl">👑</span>}
            <p className="truncate text-sm font-semibold text-white">{p.name}</p>
            <p className={`text-4xl font-black ${p.crown ? "text-amber-400" : "text-gray-400"}`}>
              {p.score}
            </p>
            <p className="text-xs text-gray-500">pts</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReplay}
          className="rounded-xl bg-amber-500 px-6 py-2.5 font-semibold text-gray-950 transition-colors hover:bg-amber-400"
        >
          Rejouer
        </button>
        <a
          href="/"
          className="rounded-xl border border-gray-700 px-6 py-2.5 font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
        >
          Accueil
        </a>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function DuelLobby({ user }: { user: User }) {
  const supabase = createClient();

  const [step, setStep]           = useState<LobbyStep>("setup");
  const [duel, setDuel]           = useState<Duel | null>(null);
  const [isHost, setIsHost]       = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  const countdownStartedRef = useRef(false);
  const channelRef          = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const displayName = user.user_metadata?.full_name ?? user.email ?? "Joueur";

  // ── Realtime subscription ───────────────────────────────────────────────────

  function subscribeToDuel(duelId: string) {
    const channel = supabase
      .channel(`duel-${duelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "duels",
          filter: `id=eq.${duelId}`,
        },
        (payload) => {
          const updated = payload.new as Duel;
          setDuel(updated);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return channel;
  }

  // ── Watch duel state changes ────────────────────────────────────────────────

  useEffect(() => {
    if (!duel) return;

    // Guest joined → host gets 'ready' signal → start countdown
    if (duel.status === "ready" && !countdownStartedRef.current) {
      countdownStartedRef.current = true;
      loadQuestionsAndCountdown(duel);
    }

    // Both scores submitted → show results
    if (duel.host_score !== null && duel.guest_score !== null && step !== "results") {
      setStep("results");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel]);

  async function loadQuestionsAndCountdown(d: Duel) {
    const qs = await getDuelQuestions(supabase, d.question_ids);
    setQuestions(qs);
    setStep("countdown");

    let c = 3;
    setCountdown(c);
    const interval = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(interval);
        setStep("playing");
      } else {
        setCountdown(c);
      }
    }, 1000);
  }

  // ── Host creates duel ────────────────────────────────────────────────────────

  async function handleHost(difficulty: QuizDifficulty) {
    const d = await createDuel(supabase, user.id, displayName, difficulty);
    setDuel(d);
    setIsHost(true);
    setStep("waiting");
    subscribeToDuel(d.id);
  }

  // ── Guest joins duel ─────────────────────────────────────────────────────────

  async function handleJoin(code: string) {
    const d = await joinDuel(supabase, code, user.id, displayName);
    setDuel(d);
    setIsHost(false);
    subscribeToDuel(d.id);
    countdownStartedRef.current = true;
    await loadQuestionsAndCountdown(d);
  }

  // ── Quiz complete ────────────────────────────────────────────────────────────

  async function handleComplete(score: number) {
    if (!duel) return;
    setStep("submitting");
    await submitDuelAnswers(supabase, duel.id, isHost ? "host" : "guest", score);
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function handleReplay() {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    countdownStartedRef.current = false;
    setDuel(null);
    setIsHost(false);
    setQuestions([]);
    setCountdown(3);
    setStep("setup");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (step === "setup") {
    return <SetupView onHost={handleHost} onJoin={handleJoin} />;
  }

  if (step === "waiting") {
    return <WaitingView code={duel!.code} isHost={isHost} />;
  }

  if (step === "countdown") {
    return <CountdownView count={countdown} />;
  }

  if (step === "playing") {
    return (
      <QuizCard
        questions={questions}
        difficulty={duel!.difficulty as QuizDifficulty}
        onComplete={(score) => handleComplete(score)}
      />
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-sm text-gray-400">En attente de l&apos;adversaire…</p>
      </div>
    );
  }

  if (step === "results" && duel) {
    return <ResultsView duel={duel} isHost={isHost} onReplay={handleReplay} />;
  }

  return null;
}
