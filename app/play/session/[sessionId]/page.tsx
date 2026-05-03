"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  MODE_LABELS,
  MODE_POINTS,
  isCashCorrect,
  type McqMode,
} from "@/components/QuizCard";

const DEFAULT_QUESTION_DURATION = 15;

type Phase = "question" | "reveal" | "leaderboard";

type Session = {
  id: string;
  code: string;
  title: string;
  teacher_id: string | null;
  status: "waiting" | "playing" | "finished";
  current_question_index: number;
  question_ids: string[];
  question_started_at: string | null;
  question_duration: number;
  auto_advance: boolean;
};

type Player = {
  id: string;
  nickname: string;
  score: number;
};

type QuizQuestion = {
  id: string;
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation?: string | null;
  difficulty?: number | null;
  period?: string | null;
};

type SessionAnswer = {
  id: string;
  session_id: string;
  player_id: string;
  question_id: string;
  question_index: number;
  mode: McqMode | "truefalse";
  answer_index: number | null;
  cash_answer: string | null;
  is_correct: boolean;
  points: number;
};

export default function PlaySessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [myAnswer, setMyAnswer] = useState<SessionAnswer | null>(null);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);

  const [mode, setMode] = useState<McqMode | null>(null);
  const [duoIndices, setDuoIndices] = useState<[number, number] | null>(null);
  const [cashInput, setCashInput] = useState("");

  const [timeLeft, setTimeLeft] = useState(DEFAULT_QUESTION_DURATION);
  const prevTimeLeftRef = useRef(DEFAULT_QUESTION_DURATION);
  const [phase, setPhase] = useState<Phase>("question");
  const [phaseLockedIndex, setPhaseLockedIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const questionDuration =
    session?.question_duration ?? DEFAULT_QUESTION_DURATION;

  const isTrueFalse = question?.type === "truefalse";
  const effectiveMode: McqMode | "truefalse" = isTrueFalse
    ? "truefalse"
    : mode ?? "carre";

  const pointsPossible = MODE_POINTS[effectiveMode];

  const displayIndices: number[] = !question
    ? []
    : isTrueFalse
    ? [0, 1]
    : mode === "duo"
    ? duoIndices ?? []
    : mode === "carre"
    ? question.options.map((_, index) => index)
    : [];

  const isTwoCol = isTrueFalse || mode === "duo";
  const answerCount = answers.length;
  const correctCount = answers.filter((answer) => answer.is_correct).length;
  const isTimeOver = timeLeft <= 0;

  const showReveal = phase === "reveal";
  const showLeaderboard = phase === "leaderboard";
  const canAnswer = phase === "question" && !isTimeOver;

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("session_players")
      .select("id, nickname, score")
      .eq("session_id", params.sessionId)
      .order("score", { ascending: false });

    if (error) {
      setMessage("Impossible de charger les joueurs.");
      return;
    }

    setPlayers((data ?? []) as Player[]);
  }

  async function loadAnswers() {
    if (!session) return;

    const { data } = await supabase
      .from("session_answers")
      .select(
        "id, session_id, player_id, question_id, question_index, mode, answer_index, cash_answer, is_correct, points"
      )
      .eq("session_id", session.id)
      .eq("question_index", session.current_question_index);

    const typedAnswers = (data ?? []) as SessionAnswer[];
    setAnswers(typedAnswers);

    if (playerId) {
      setMyAnswer(
        typedAnswers.find((answer) => answer.player_id === playerId) ?? null
      );
    }
  }

  async function checkTeacherAccess(sessionData: Session) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsTeacher(!!user && sessionData.teacher_id === user.id);
  }

  async function loadSession() {
    setLoading(true);
    setMessage(null);

    const storedPlayerId = localStorage.getItem("school_session_player_id");
    const storedSessionId = localStorage.getItem("school_session_id");
    const storedNickname = localStorage.getItem("school_session_nickname");

    setPlayerId(storedPlayerId);
    setNickname(storedNickname);

    const { data: sessionData, error: sessionError } = await supabase
      .from("school_game_sessions")
      .select(
        "id, code, title, teacher_id, status, current_question_index, question_ids, question_started_at, question_duration, auto_advance"
      )
      .eq("id", params.sessionId)
      .maybeSingle();

    if (sessionError || !sessionData) {
      setMessage("Session introuvable.");
      setLoading(false);
      return;
    }

    const typedSession = sessionData as Session;

    setSession(typedSession);
    await checkTeacherAccess(typedSession);
    await loadPlayers();

    if (storedSessionId && storedSessionId !== params.sessionId) {
      setNickname(null);
      setPlayerId(null);
    }

    setLoading(false);
  }

  async function loadCurrentQuestion(questionId: string) {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select(
        "id, type, question, options, answer_index, explanation, difficulty, period"
      )
      .eq("id", questionId)
      .maybeSingle();

    if (error || !data) {
      setQuestion(null);
      setMessage("Impossible de charger la question.");
      return;
    }

    setQuestion(data as QuizQuestion);
    setMode(null);
    setDuoIndices(null);
    setCashInput("");
    setMyAnswer(null);
  }

  async function updateSessionSettings({
    questionDuration,
    autoAdvance,
  }: {
    questionDuration?: number;
    autoAdvance?: boolean;
  }) {
    if (!session || !isTeacher) return;

    const newQuestionDuration =
      typeof questionDuration === "number"
        ? questionDuration
        : session.question_duration;

    const newAutoAdvance =
      typeof autoAdvance === "boolean" ? autoAdvance : session.auto_advance;

    const { error } = await supabase.rpc("update_school_session_settings", {
      target_session_id: session.id,
      new_question_duration: newQuestionDuration,
      new_auto_advance: newAutoAdvance,
    });

    if (error) {
      alert("Impossible de modifier les réglages.");
      return;
    }

    setSession({
      ...session,
      question_duration: newQuestionDuration,
      auto_advance: newAutoAdvance,
    });
  }

  async function startSession() {
    if (!session) return;

    const { error } = await supabase.rpc("start_school_session", {
      target_session_id: session.id,
    });

    if (error) {
      alert("Impossible de lancer la session.");
      return;
    }

    setPhase("question");
    setPhaseLockedIndex(null);
    await loadSession();
  }

  async function finishSession() {
    if (!session) return;

    const ok = confirm("Terminer cette session ?");
    if (!ok) return;

    const { error } = await supabase.rpc("finish_school_session", {
      target_session_id: session.id,
    });

    if (error) {
      alert("Impossible de terminer la session.");
      return;
    }

    await loadSession();
  }

  async function nextQuestion() {
    if (!session) return;

    const nextIndex = session.current_question_index + 1;

    if (nextIndex >= session.question_ids.length) {
      await finishSession();
      return;
    }

    const { error } = await supabase.rpc("next_school_session_question", {
      target_session_id: session.id,
    });

    if (error) {
      alert("Impossible de passer à la question suivante.");
      return;
    }

    setQuestion(null);
    setMyAnswer(null);
    setAnswers([]);
    setMode(null);
    setDuoIndices(null);
    setCashInput("");
    setPhase("question");
    setPhaseLockedIndex(null);

    await loadSession();
  }

  async function resetSession() {
    if (!session) return;

    const { error } = await supabase
      .from("school_game_sessions")
      .update({
        status: "waiting",
        current_question_index: 0,
        question_started_at: null,
        started_at: null,
        finished_at: null,
      })
      .eq("id", session.id);

    if (error) {
      alert("Impossible de reset la session.");
      return;
    }

    setPhase("question");
    setPhaseLockedIndex(null);
    await loadSession();
  }

  async function addFakePlayers() {
    if (!session) return;

    const bots = Array.from({ length: 5 }, () => ({
      session_id: session.id,
      nickname: `Bot_${Math.floor(Math.random() * 1000)}`,
      score: 0,
    }));

    const { error } = await supabase.from("session_players").insert(bots);

    if (error) {
      alert("Impossible d’ajouter les bots.");
      return;
    }

    await loadPlayers();
  }

  async function clearPlayers() {
    if (!session) return;

    const ok = confirm("Supprimer tous les joueurs de cette session ?");
    if (!ok) return;

    const { error } = await supabase
      .from("session_players")
      .delete()
      .eq("session_id", session.id);

    if (error) {
      alert("Impossible de supprimer les joueurs.");
      return;
    }

    localStorage.removeItem("school_session_player_id");
    localStorage.removeItem("school_session_id");
    localStorage.removeItem("school_session_nickname");

    setPlayerId(null);
    setNickname(null);
    await loadPlayers();
  }

  function handleSelectMode(selectedMode: McqMode) {
    if (!question || myAnswer || !canAnswer) return;

    setMode(selectedMode);

    if (selectedMode === "duo") {
      const wrongs = question.options
        .map((_, index) => index)
        .filter((index) => index !== question.answer_index);

      const wrong = wrongs[Math.floor(Math.random() * wrongs.length)];

      const pair: [number, number] =
        Math.random() > 0.5
          ? [question.answer_index, wrong]
          : [wrong, question.answer_index];

      setDuoIndices(pair);
    }
  }

  async function submitAnswer({
    answerIndex,
    cashAnswer,
  }: {
    answerIndex?: number;
    cashAnswer?: string;
  }) {
    if (!session || !question || !playerId || myAnswer || !canAnswer) return;

    const correctAnswer = question.options[question.answer_index];

    const isCorrect =
      effectiveMode === "cash"
        ? isCashCorrect(cashAnswer ?? "", correctAnswer)
        : answerIndex === question.answer_index;

    const points = isCorrect ? pointsPossible : 0;

    const { data, error } = await supabase
      .from("session_answers")
      .insert({
        session_id: session.id,
        player_id: playerId,
        question_id: question.id,
        question_index: session.current_question_index,
        mode: effectiveMode,
        answer_index: typeof answerIndex === "number" ? answerIndex : null,
        cash_answer: cashAnswer ?? null,
        is_correct: isCorrect,
        points,
      })
      .select(
        "id, session_id, player_id, question_id, question_index, mode, answer_index, cash_answer, is_correct, points"
      )
      .single();

    if (error || !data) {
      alert("Réponse déjà envoyée ou impossible à enregistrer.");
      return;
    }

    setMyAnswer(data as SessionAnswer);

    const { data: allMyAnswers } = await supabase
      .from("session_answers")
      .select("points")
      .eq("session_id", session.id)
      .eq("player_id", playerId);

    const totalScore = (allMyAnswers ?? []).reduce(
      (sum, answer) => sum + (answer.points ?? 0),
      0
    );

    await supabase
      .from("session_players")
      .update({ score: totalScore })
      .eq("id", playerId);

    await loadAnswers();
    await loadPlayers();
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("school_game_sessions")
        .select(
          "status, current_question_index, question_started_at, question_ids, question_duration, auto_advance"
        )
        .eq("id", params.sessionId)
        .maybeSingle();

      if (!data) return;

      setSession((current) => {
        if (!current) return current;

        return {
          ...current,
          status: data.status as Session["status"],
          current_question_index: data.current_question_index,
          question_started_at: data.question_started_at,
          question_ids: data.question_ids ?? [],
          question_duration:
            data.question_duration ?? DEFAULT_QUESTION_DURATION,
          auto_advance: data.auto_advance ?? false,
        };
      });

      await loadPlayers();
      await loadAnswers();
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.sessionId,
    supabase,
    session?.id,
    session?.current_question_index,
    playerId,
  ]);

  useEffect(() => {
    if (!session || session.status !== "playing") return;

    const questionId = session.question_ids?.[session.current_question_index];
    if (!questionId) return;

    loadCurrentQuestion(questionId);
    setPhase("question");
    setPhaseLockedIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.current_question_index, session?.status, supabase]);

  useEffect(() => {
    if (session) {
      loadAnswers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.current_question_index, playerId]);

  useEffect(() => {
    if (!session?.question_started_at || session.status !== "playing") {
      setTimeLeft(questionDuration);
      return;
    }

    const updateTimer = () => {
      const start = new Date(session.question_started_at!).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setTimeLeft(Math.max(questionDuration - elapsed, 0));
    };

    updateTimer();

    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [session?.question_started_at, session?.status, questionDuration]);

  useEffect(() => {
    if (!session || session.status !== "playing") return;
    if (timeLeft > 0) return;
    if (prevTimeLeftRef.current <= 0) return;
    if (phaseLockedIndex === session.current_question_index) return;

    setPhaseLockedIndex(session.current_question_index);
    setPhase("reveal");

    const revealTimeout = setTimeout(() => {
      setPhase("leaderboard");

      if (isTeacher && session.auto_advance) {
        setTimeout(() => {
          nextQuestion();
        }, 2500);
      }
    }, 2000);

    return () => clearTimeout(revealTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, session?.current_question_index, session?.status]);

  useEffect(() => {
    prevTimeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    const channel = supabase
      .channel(`school-session-${params.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "school_game_sessions",
          filter: `id=eq.${params.sessionId}`,
        },
        (payload) => {
          setSession(payload.new as Session);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${params.sessionId}`,
        },
        () => {
          loadPlayers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_answers",
          filter: `session_id=eq.${params.sessionId}`,
        },
        () => {
          loadAnswers();
          loadPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId, supabase, session?.id, session?.current_question_index]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        Chargement de la session...
      </main>
    );
  }

  if (message || !session) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="font-bold text-red-300">
            {message ?? "Session introuvable."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Session de classe
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-black">{session.title}</h1>
              <p className="mt-2 text-gray-400">
                Code :{" "}
                <span className="font-mono font-black text-amber-400">
                  {session.code}
                </span>
              </p>

              {nickname && (
                <p className="mt-2 text-sm text-gray-500">
                  Tu joues sous le pseudo{" "}
                  <span className="font-bold text-white">{nickname}</span>
                </p>
              )}

              {isTeacher && (
                <p className="mt-2 inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-green-300">
                  Mode professeur
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm">
              Statut :{" "}
              <span className="font-black text-amber-400">
                {session.status === "waiting"
                  ? "En attente"
                  : session.status === "playing"
                  ? "En cours"
                  : "Terminée"}
              </span>
            </div>
          </div>

          {isTeacher && (
            <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-5">
              <h2 className="text-lg font-black">Contrôles professeur</h2>

              {session.status === "waiting" && (
                <div className="mt-4 grid gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                      Temps par question
                    </label>

                    <select
                      value={session.question_duration}
                      onChange={(event) =>
                        updateSessionSettings({
                          questionDuration: Number(event.target.value),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 font-bold text-white outline-none focus:border-amber-500"
                    >
                      <option value={10}>10 secondes</option>
                      <option value={15}>15 secondes</option>
                      <option value={20}>20 secondes</option>
                      <option value={30}>30 secondes</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                      Enchaînement automatique
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        updateSessionSettings({
                          autoAdvance: !session.auto_advance,
                        })
                      }
                      className={`mt-2 w-full rounded-xl px-4 py-3 font-black transition ${
                        session.auto_advance
                          ? "bg-green-500 text-gray-950"
                          : "border border-gray-700 bg-gray-950 text-gray-300"
                      }`}
                    >
                      {session.auto_advance ? "Activé" : "Désactivé"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {session.status === "waiting" && (
                  <button
                    type="button"
                    onClick={startSession}
                    className="rounded-2xl bg-green-500 px-5 py-3 font-black text-gray-950 transition hover:bg-green-400"
                  >
                    🚀 Lancer la partie
                  </button>
                )}

                {session.status === "playing" && (
                  <>
                    {!session.auto_advance && (
                      <button
                        type="button"
                        onClick={nextQuestion}
                        className="rounded-2xl bg-amber-500 px-5 py-3 font-black text-gray-950 transition hover:bg-amber-400"
                      >
                        Question suivante →
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={finishSession}
                      className="rounded-2xl bg-red-500 px-5 py-3 font-black text-white transition hover:bg-red-400"
                    >
                      Terminer
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded-2xl border border-gray-700 bg-gray-800 px-5 py-3 font-black text-gray-200"
                >
                  Reset session
                </button>

                <button
                  type="button"
                  onClick={addFakePlayers}
                  className="rounded-2xl bg-blue-500 px-5 py-3 font-black text-gray-950"
                >
                  +5 bots
                </button>

                <button
                  type="button"
                  onClick={clearPlayers}
                  className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-black text-red-300"
                >
                  Nettoyer joueurs
                </button>
              </div>
            </div>
          )}

          {session.status === "waiting" && (
            <div className="mt-8 overflow-hidden rounded-3xl border border-amber-500/20 bg-gray-950">
              <div className="relative bg-gradient-to-br from-amber-500/20 via-gray-950 to-gray-950 p-8 text-center">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-400">
                  Lobby de classe
                </p>

                <h2 className="mt-3 text-3xl font-black text-white">
                  {isTeacher
                    ? "Invite tes élèves à rejoindre la partie"
                    : "En attente du professeur"}
                </h2>

                <div className="mx-auto mt-6 max-w-md rounded-3xl border border-amber-500/30 bg-gray-950/80 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    Code de session
                  </p>

                  <p className="mt-2 font-mono text-6xl font-black tracking-widest text-amber-400">
                    {session.code}
                  </p>

                  <p className="mt-3 text-sm text-gray-500">
                    Les élèves vont sur{" "}
                    <span className="font-bold text-white">/join</span>.
                  </p>

                  <p className="mt-3 text-xs text-gray-500">
                    {session.question_duration}s/question ·{" "}
                    {session.auto_advance
                      ? "enchaînement automatique"
                      : "enchaînement manuel"}
                  </p>
                </div>

                {isTeacher && (
                  <button
                    type="button"
                    onClick={startSession}
                    disabled={players.length === 0}
                    className="mt-6 rounded-2xl bg-green-500 px-8 py-4 text-lg font-black text-gray-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    🚀 Lancer la partie
                  </button>
                )}
              </div>

              <div className="border-t border-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white">
                    Élèves connectés
                  </h3>

                  <span className="rounded-full bg-gray-800 px-3 py-1 text-sm font-bold text-gray-300">
                    {players.length}
                  </span>
                </div>

                {players.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/50 p-6 text-center text-gray-500">
                    Aucun élève pour le moment.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {players.map((player, index) => (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between rounded-2xl border p-4 ${
                          player.id === playerId
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-gray-800 bg-gray-900"
                        }`}
                      >
                        <div>
                          <p className="font-black text-white">
                            #{index + 1} {player.nickname}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Prêt à jouer
                          </p>
                        </div>

                        <span className="text-2xl">✅</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {session.status === "playing" && (
            <div className="mt-8 rounded-3xl border border-green-500/20 bg-green-500/10 p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-bold uppercase tracking-widest text-green-300">
                  Question {session.current_question_index + 1} /{" "}
                  {session.question_ids.length}
                </p>

                <div
                  className={`rounded-full px-4 py-2 text-2xl font-black ${
                    timeLeft <= 5
                      ? "bg-red-500 text-white"
                      : "bg-amber-500 text-gray-950"
                  }`}
                >
                  {timeLeft}s
                </div>
              </div>

              {question ? (
                <>
                  <h2 className="mt-5 text-3xl font-black text-white">
                    {question.question}
                  </h2>

                  {showReveal && (
                    <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                      <p className="text-sm font-black uppercase tracking-widest text-green-300">
                        Bonne réponse
                      </p>

                      <p className="mt-2 text-2xl font-black text-white">
                        {question.options[question.answer_index]}
                      </p>

                      {question.explanation && (
                        <p className="mt-3 text-sm leading-relaxed text-gray-300">
                          {question.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  {showLeaderboard && (
                    <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                      <h2 className="text-2xl font-black text-white">
                        Classement
                      </h2>

                      <div className="mt-6 space-y-3">
                        {players.slice(0, 5).map((player, index) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3"
                          >
                            <span className="font-black text-amber-400">
                              #{index + 1} {player.nickname}
                            </span>

                            <span className="font-black text-green-400">
                              {player.score} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isTeacher ? (
                    <>
                      <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5">
                        <h3 className="text-lg font-black">Réponses live</h3>

                        <p className="mt-2 text-gray-400">
                          {answerCount}/{players.length} joueur(s) ont répondu ·{" "}
                          <span className="text-green-400">
                            {correctCount} correcte(s)
                          </span>
                        </p>
                      </div>

                      <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5">
                        <h3 className="text-lg font-black text-white">
                          Classement live
                        </h3>

                        <div className="mt-4 space-y-2">
                          {players.slice(0, 5).map((player, index) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3"
                            >
                              <span className="font-bold text-white">
                                #{index + 1} {player.nickname}
                              </span>

                              <span className="font-black text-green-400">
                                {player.score} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : myAnswer ? (
                    <div
                      className={`mt-6 rounded-2xl border p-5 ${
                        myAnswer.is_correct
                          ? "border-green-500/30 bg-green-500/10"
                          : "border-red-500/30 bg-red-500/10"
                      }`}
                    >
                      <p className="text-lg font-black">
                        {myAnswer.is_correct
                          ? "Bonne réponse !"
                          : "Réponse envoyée"}
                      </p>

                      <p className="mt-1 text-sm text-gray-300">
                        Score gagné :{" "}
                        <span className="font-black text-amber-400">
                          +{myAnswer.points}
                        </span>
                      </p>
                    </div>
                  ) : showReveal || showLeaderboard ? (
                    <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-5 text-center">
                      <p className="text-lg font-black text-white">
                        Manche terminée
                      </p>
                      <p className="mt-2 text-sm text-gray-400">
                        En attente de la question suivante…
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6">
                      {!isTrueFalse && mode === null && (
                        <div>
                          <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-500">
                            Choisis ton mode
                          </p>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {(["cash", "carre", "duo"] as McqMode[]).map(
                              (choice) => (
                                <button
                                  key={choice}
                                  type="button"
                                  disabled={!canAnswer}
                                  onClick={() => handleSelectMode(choice)}
                                  className="flex flex-col items-center gap-1 rounded-xl border border-gray-700 bg-gray-950 px-3 py-4 transition hover:border-amber-500/50 hover:bg-gray-900 disabled:cursor-not-allowed"
                                >
                                  <span className="font-black text-white">
                                    {MODE_LABELS[choice]}
                                  </span>
                                  <span className="text-sm font-bold text-amber-400">
                                    +{MODE_POINTS[choice]}
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {(isTrueFalse || mode !== null) &&
                        (effectiveMode === "cash" ? (
                          <div className="mt-4 flex gap-2">
                            <input
                              type="text"
                              value={cashInput}
                              disabled={!canAnswer}
                              onChange={(event) =>
                                setCashInput(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" &&
                                  cashInput.trim() &&
                                  canAnswer
                                ) {
                                  submitAnswer({ cashAnswer: cashInput });
                                }
                              }}
                              placeholder="Ta réponse..."
                              autoFocus
                              className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-amber-500 disabled:cursor-not-allowed"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                submitAnswer({ cashAnswer: cashInput })
                              }
                              disabled={!cashInput.trim() || !canAnswer}
                              className="rounded-xl bg-amber-500 px-5 py-3 font-black text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Valider
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`mt-4 grid gap-3 ${
                              isTwoCol
                                ? "grid-cols-2"
                                : "grid-cols-1 sm:grid-cols-2"
                            }`}
                          >
                            {displayIndices.map((index) => (
                              <button
                                key={index}
                                type="button"
                                disabled={!canAnswer}
                                onClick={() =>
                                  submitAnswer({ answerIndex: index })
                                }
                                className={`rounded-xl border border-gray-700 bg-gray-950 px-4 py-4 text-sm font-bold text-gray-200 transition hover:border-amber-500/50 hover:bg-gray-900 disabled:cursor-not-allowed ${
                                  isTwoCol ? "text-center" : "text-left"
                                }`}
                              >
                                {!isTwoCol && (
                                  <span className="mr-2 text-xs text-gray-500">
                                    {String.fromCharCode(65 + index)}.
                                  </span>
                                )}
                                {question.options[index]}
                              </button>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 text-gray-400">
                  Chargement de la question...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}