"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import TimelineMultiplayerView from "@/components/multiplayer/TimelineMultiplayerView";
import {
  MODE_LABELS,
  MODE_POINTS,
  isCashCorrect,
  type McqMode,
} from "@/components/QuizCard";

type GameMode = "quiz" | "timeline";

type Room = {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  difficulty: number;
  status: "waiting" | "playing" | "finished";
  max_players: number;
  question_ids: string[];
  current_question_index: number;
  game_mode: GameMode;
};

type Participant = {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  score: number;
  is_host: boolean;
  joined_at: string;
};

type QuizQuestion = {
  id: string;
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation?: string | null;
};

export default function MultiplayerRoomPage({
  params,
}: {
  params: { code: string };
}) {
  const supabase = useMemo(() => createClient(), []);

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const isHost = room?.host_id === userId;

  async function loadRoom() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserId(user?.id ?? null);

    const { data: roomData, error: roomError } = await supabase
      .from("multiplayer_rooms")
      .select("*")
      .eq("code", params.code)
      .maybeSingle();

    if (roomError || !roomData) {
      setMessage("Salon introuvable.");
      setLoading(false);
      return;
    }

    setRoom(roomData as Room);

    const { data: participantData } = await supabase
      .from("multiplayer_participants")
      .select("*")
      .eq("room_id", roomData.id)
      .order("score", { ascending: false });

    setParticipants((participantData ?? []) as Participant[]);
    setLoading(false);
  }

  async function startGame() {
    if (!room || !isHost) return;

    const query =
      room.game_mode === "timeline"
        ? supabase
            .from("timeline_events")
            .select("id")
            .eq("status", "approved")
            .not("difficulty", "is", null)
            .limit(10)
        : supabase
            .from("quiz_questions")
            .select("id")
            .eq("status", "approved")
            .eq("type", "mcq")
            .limit(10);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      setMessage(
        room.game_mode === "timeline"
          ? "Pas assez d'événements timeline approuvés disponibles."
          : "Pas assez de questions QCM approuvées disponibles."
      );
      return;
    }

    const ids = data.map((item) => item.id);

    const { error: resetScoresError } = await supabase
      .from("multiplayer_participants")
      .update({ score: 0 })
      .eq("room_id", room.id);

    if (resetScoresError) {
      setMessage("Impossible de réinitialiser les scores.");
      return;
    }

    const { error: updateError } = await supabase
      .from("multiplayer_rooms")
      .update({
        status: "playing",
        question_ids: ids,
        current_question_index: 0,
        started_at: new Date().toISOString(),
      })
      .eq("id", room.id);

    if (updateError) {
      setMessage("Impossible de lancer la partie.");
      return;
    }

    setMessage(null);
  }

  useEffect(() => {
    loadRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`multiplayer-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multiplayer_participants",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          const { data } = await supabase
            .from("multiplayer_participants")
            .select("*")
            .eq("room_id", room.id)
            .order("score", { ascending: false });

          setParticipants((data ?? []) as Participant[]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "multiplayer_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          setRoom(payload.new as Room);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-10 text-white">
        Chargement du salon...
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-gray-950 p-10 text-white">
        <h1 className="text-3xl font-black">Salon introuvable</h1>
        <p className="mt-4 text-gray-400">{message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="rounded-3xl border border-gray-800 bg-gray-900/80 p-5 shadow-2xl shadow-black/40 sm:p-6 lg:p-8">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Salon multijoueur
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-black sm:text-5xl">
                Code{" "}
                <span className="font-mono text-amber-400">{room.code}</span>
              </h1>

              <p className="mt-2 text-gray-400">
                Partage ce code avec tes joueurs. Maximum {room.max_players}{" "}
                participants.
              </p>

              <p className="mt-2 text-sm text-gray-400">
                Mode :{" "}
                <span className="font-bold text-amber-400">
                  {room.game_mode === "timeline" ? "Ligne du temps" : "Quiz"}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm">
              Statut :{" "}
              <span className="font-black text-amber-400">
                {room.status === "waiting"
                  ? "En attente"
                  : room.status === "playing"
                    ? "En cours"
                    : "Terminée"}
              </span>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-300">
              {message}
            </div>
          )}

          {room.status === "playing" ? (
            room.game_mode === "timeline" ? (
              <TimelineMultiplayerView
                room={room}
                participants={participants}
              />
            ) : (
              <QuizMultiplayerView room={room} participants={participants} />
            )
          ) : room.status === "finished" ? (
            <FinalLeaderboard participants={participants} />
          ) : (
            <LobbyView
              room={room}
              participants={participants}
              isHost={isHost}
              startGame={startGame}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function LobbyView({
  room,
  participants,
  isHost,
  startGame,
}: {
  room: Room;
  participants: Participant[];
  isHost: boolean;
  startGame: () => void;
}) {
  return (
    <div className="mt-8 grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Joueurs connectés</h2>
          <span className="rounded-full bg-gray-800 px-3 py-1 text-sm font-bold text-gray-300">
            {participants.length}/{room.max_players}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="rounded-2xl border border-gray-800 bg-gray-950 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{participant.user_name}</p>

                {participant.is_host && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-gray-950">
                    Host
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Score : {participant.score}
              </p>
            </div>
          ))}
        </div>
      </section>

      <aside className="rounded-3xl border border-gray-800 bg-gray-950 p-5 xl:w-[280px]">
        <h2 className="text-lg font-black">Contrôles</h2>

        {isHost ? (
          <>
            <p className="mt-2 text-sm text-gray-400">
              Tu es le créateur du salon. Lance la partie quand tout le monde
              est prêt.
            </p>

            <button
              type="button"
              onClick={startGame}
              disabled={participants.length < 1}
              className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 font-black text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {room.game_mode === "timeline"
                ? "Lancer la timeline"
                : "Lancer le quiz"}
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            En attente du lancement par {room.host_name}.
          </p>
        )}
      </aside>
    </div>
  );
}

function QuizMultiplayerView({
  room,
  participants,
}: {
  room: Room;
  participants: Participant[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [mode, setMode] = useState<McqMode | null>(null);
  const [duoIndices, setDuoIndices] = useState<[number, number] | null>(null);
  const [cashInput, setCashInput] = useState("");
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [showReveal, setShowReveal] = useState(false);
  const [answersCount, setAnswersCount] = useState(0);
  const [bonusPop, setBonusPop] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(
    room.current_question_index
  );

  const pointsPossible = mode ? MODE_POINTS[mode] : 0;
  const liveSpeedBonus = timeLeft > 7 ? 100 : timeLeft > 4 ? 50 : 0;

  useEffect(() => {
    async function loadQuestion() {
      setQuestion(null);
      setMode(null);
      setDuoIndices(null);
      setCashInput("");
      setAnswered(false);
      setSelectedAnswer(null);
      setFeedback(null);
      setTimeLeft(10);
      setShowReveal(false);
      setAnswersCount(0);
      setBonusPop(null);
      setActiveQuestionIndex(room.current_question_index);

      const questionId = room.question_ids?.[room.current_question_index];

      if (!questionId) {
        setFeedback("Aucune question trouvée pour cette manche.");
        return;
      }

      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, type, question, options, answer_index, explanation")
        .eq("id", questionId)
        .single();

      if (error || !data) {
        setFeedback("Impossible de charger la question.");
        return;
      }

      setQuestion(data as QuizQuestion);
    }

    loadQuestion();
  }, [room.current_question_index, room.question_ids, supabase]);

  useEffect(() => {
    if (room.status !== "playing") return;
    if (activeQuestionIndex !== room.current_question_index) return;
    if (!question) return;
    if (showReveal) return;

    const interval = setInterval(() => {
      setTimeLeft((currentTime) => {
        if (currentTime <= 1) {
          clearInterval(interval);
          return 0;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    room.current_question_index,
    room.status,
    activeQuestionIndex,
    question,
    showReveal,
  ]);

  useEffect(() => {
    if (!room.id) return;
    if (!question) return;
    if (showReveal) return;

    async function loadAnswersCount() {
      const { count } = await supabase
        .from("multiplayer_answers")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("question_index", room.current_question_index);

      setAnswersCount(count ?? 0);
    }

    loadAnswersCount();

    const channel = supabase
      .channel(`answers-${room.id}-${room.current_question_index}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "multiplayer_answers",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          loadAnswersCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, room.current_question_index, question, showReveal, supabase]);

  useEffect(() => {
    if (!question) return;
    if (showReveal) return;
    if (participants.length === 0) return;

    if (answersCount >= participants.length) {
      setTimeLeft(0);
    }
  }, [answersCount, participants.length, question, showReveal]);

  useEffect(() => {
    if (activeQuestionIndex !== room.current_question_index) return;
    if (!question) return;
    if (timeLeft > 0) return;

    setShowReveal(true);
  }, [timeLeft, activeQuestionIndex, room.current_question_index, question]);

  useEffect(() => {
    if (!showReveal) return;
    if (activeQuestionIndex !== room.current_question_index) return;

    const timeout = setTimeout(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id !== room.host_id) return;

      const nextIndex = room.current_question_index + 1;

      if (nextIndex >= room.question_ids.length) {
        await supabase
          .from("multiplayer_rooms")
          .update({
            status: "finished",
            finished_at: new Date().toISOString(),
          })
          .eq("id", room.id);

        return;
      }

      await supabase
        .from("multiplayer_rooms")
        .update({
          current_question_index: nextIndex,
        })
        .eq("id", room.id);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [showReveal, activeQuestionIndex, room, supabase]);

  function handleSelectMode(selectedMode: McqMode) {
    if (!question || answered || showReveal) return;

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
    if (!question || !mode || answered || showReveal) return;

    setAnswered(true);

    if (typeof answerIndex === "number") {
      setSelectedAnswer(answerIndex);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFeedback("Tu dois être connecté pour répondre.");
      return;
    }

    const correctAnswer = question.options[question.answer_index];

    const isCorrect =
      mode === "cash"
        ? isCashCorrect(cashAnswer ?? "", correctAnswer)
        : answerIndex === question.answer_index;

    const timeBonus = timeLeft > 7 ? 100 : timeLeft > 4 ? 50 : 0;
    const basePoints = MODE_POINTS[mode];
    const points = isCorrect ? basePoints + timeBonus : 0;

    if (isCorrect && timeBonus > 0) {
      setBonusPop(`+${timeBonus} ⚡`);
      setTimeout(() => setBonusPop(null), 1200);
    }

    const { error: answerError } = await supabase
      .from("multiplayer_answers")
      .insert({
        room_id: room.id,
        user_id: user.id,
        question_index: room.current_question_index,
        answer_index: typeof answerIndex === "number" ? answerIndex : null,
        is_correct: isCorrect,
        points,
      });

    if (answerError) {
      setFeedback("Réponse déjà envoyée.");
      return;
    }

    const { data: allMyAnswers } = await supabase
      .from("multiplayer_answers")
      .select("points")
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    const totalScore = (allMyAnswers ?? []).reduce(
      (sum, answer) => sum + (answer.points ?? 0),
      0
    );

    await supabase
      .from("multiplayer_participants")
      .update({
        score: totalScore,
      })
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    setFeedback(
      isCorrect
        ? `🔥 Bonne réponse ! +${basePoints} pts${
            timeBonus ? ` +${timeBonus} ⚡` : ""
          }`
        : `❌ Mauvaise réponse. Bonne réponse : ${correctAnswer}`
    );
  }

  if (!question) {
    return (
      <div className="mt-8 rounded-3xl border border-gray-800 bg-gray-950 p-6">
        Chargement de la question...
      </div>
    );
  }

  const displayIndices =
    mode === "duo"
      ? duoIndices ?? []
      : mode === "carre"
        ? question.options.map((_, index) => index)
        : [];

  const sortedParticipants = [...participants].sort(
    (a, b) => b.score - a.score
  );

  return (
    <div className="mt-8 grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="relative min-w-0 rounded-3xl border border-gray-800 bg-gray-950 p-6">
        {bonusPop && (
          <div className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2 animate-bounce rounded-full bg-amber-400 px-6 py-3 text-2xl font-black text-gray-950 shadow-2xl">
            {bonusPop}
          </div>
        )}

        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Question {room.current_question_index + 1} /{" "}
            {room.question_ids.length}
          </p>

          <span
            className={`rounded-full px-4 py-1 font-black ${
              timeLeft <= 3 && !showReveal
                ? "bg-red-500 text-white"
                : "bg-amber-500 text-gray-950"
            }`}
          >
            {showReveal
              ? "Réponse !"
              : `⏱ ${timeLeft}s · ${answersCount}/${participants.length}`}
          </span>
        </div>

        <h2 className="text-2xl font-black text-white">{question.question}</h2>

        {!mode && !answered && !showReveal && (
          <div className="mt-6">
            <p className="text-center text-xs uppercase tracking-widest text-gray-500">
              Choisis ton mode
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["cash", "carre", "duo"] as McqMode[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleSelectMode(choice)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-4 transition-all hover:border-amber-500/50 hover:bg-gray-800 active:scale-95"
                >
                  <span className="text-base font-bold text-white">
                    {MODE_LABELS[choice]}
                  </span>
                  <span className="text-sm font-semibold text-amber-400">
                    +{MODE_POINTS[choice]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {choice === "cash"
                      ? "Réponse libre"
                      : choice === "carre"
                        ? "4 choix"
                        : "2 choix"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode && !answered && !showReveal && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Mode {MODE_LABELS[mode]} · {pointsPossible} pts possibles
              </p>

              <p className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">
                Bonus vitesse :{" "}
                <span className="text-amber-400">
                  {liveSpeedBonus > 0 ? `+${liveSpeedBonus} ⚡` : "+0"}
                </span>
              </p>
            </div>

            {mode === "cash" ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && cashInput.trim()) {
                      submitAnswer({ cashAnswer: cashInput });
                    }
                  }}
                  placeholder="Votre réponse..."
                  autoFocus
                  className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => submitAnswer({ cashAnswer: cashInput })}
                  disabled={!cashInput.trim()}
                  className="shrink-0 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Valider
                </button>
              </div>
            ) : (
              <div
                className={`grid gap-3 ${
                  mode === "duo"
                    ? "grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2"
                }`}
              >
                {displayIndices.map((index) => (
                  <button
                    key={`${question.id}-${index}`}
                    type="button"
                    onClick={() => submitAnswer({ answerIndex: index })}
                    className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3.5 text-left text-sm font-medium text-gray-200 transition-all hover:border-amber-500/50 hover:bg-gray-800"
                  >
                    {question.options[index]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(answered || showReveal) && (
          <div className="mt-6 space-y-3">
            {feedback && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-300">
                <span className="animate-pulse">{feedback}</span>
              </div>
            )}

            {showReveal && (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm font-bold text-green-300">
                Bonne réponse : {question.options[question.answer_index]}
              </div>
            )}

            {showReveal && !answered && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                Temps écoulé. Aucun point marqué.
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="rounded-3xl border border-gray-800 bg-gray-950 p-5 xl:w-[280px]">
        <h2 className="text-lg font-black">
          {showReveal ? "Classement après la question" : "Classement live"}
        </h2>

        <div className="mt-4 space-y-2">
          {sortedParticipants.map((participant, index) => (
            <div
              key={participant.id}
              className="flex items-center justify-between rounded-2xl bg-gray-900 px-3 py-2"
            >
              <span className="text-sm font-bold">
                #{index + 1} {participant.user_name}
              </span>
              <span className="text-sm font-black text-amber-400">
                {participant.score}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function FinalLeaderboard({ participants }: { participants: Participant[] }) {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const topThree = sorted.slice(0, 3);

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-gray-900 to-gray-950 p-8 text-center">
        <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute inset-x-0 top-8 text-6xl opacity-10">
          🎉 🏆 🎉
        </div>

        <p className="relative text-sm font-bold uppercase tracking-widest text-amber-400">
          Partie terminée
        </p>

        <h2 className="relative mt-3 text-4xl font-black text-white">
          🏆 Victoire de {winner?.user_name ?? "Personne"}
        </h2>

        <p className="relative mt-2 text-gray-400">
          Score final :{" "}
          <span className="font-black text-amber-400">
            {winner?.score ?? 0} pts
          </span>
        </p>
      </div>

      <div className="grid items-end gap-4 p-6 md:grid-cols-3">
        {topThree.map((participant, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
          const height =
            index === 0
              ? "md:min-h-[220px]"
              : index === 1
                ? "md:min-h-[180px]"
                : "md:min-h-[150px]";

          return (
            <div
              key={participant.id}
              className={`relative rounded-3xl border p-5 text-center shadow-lg transition-all duration-500 hover:-translate-y-1 hover:scale-[1.02] ${
                height
              } ${
                index === 0
                  ? "order-1 border-amber-400 bg-amber-500/10 ring-4 ring-amber-400/10 md:order-2"
                  : index === 1
                    ? "order-2 border-slate-400/50 bg-slate-400/10 md:order-1"
                    : "order-3 border-orange-700/50 bg-orange-700/10 md:order-3"
              }`}
            >
              {index === 0 && (
                <div className="absolute -inset-1 rounded-3xl bg-amber-400/20 blur-xl" />
              )}

              <div className="relative">
                <div
                  className={
                    index === 0 ? "animate-bounce text-6xl" : "text-5xl"
                  }
                >
                  {medal}
                </div>

                <p className="mt-4 text-lg font-black text-white">
                  {participant.user_name}
                </p>

                <p className="mt-2 text-3xl font-black text-amber-400">
                  {participant.score}
                </p>

                <p className="text-xs uppercase tracking-widest text-gray-500">
                  points
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-800 p-6">
        <h3 className="text-xl font-black text-white">Classement complet</h3>

        <div className="mt-4 space-y-2">
          {sorted.map((participant, index) => (
            <div
              key={participant.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                index === 0
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              <span className="font-bold text-white">
                #{index + 1} {participant.user_name}
              </span>

              <span className="font-black text-amber-400">
                {participant.score} pts
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => (window.location.href = "/multiplayer")}
            className="rounded-2xl bg-amber-500 px-5 py-3 font-black text-gray-950 transition hover:bg-amber-400"
          >
            Rejouer
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="rounded-2xl border border-gray-700 px-5 py-3 font-black text-gray-300 transition hover:bg-gray-900"
          >
            Retour accueil
          </button>
        </div>
      </div>
    </div>
  );
}