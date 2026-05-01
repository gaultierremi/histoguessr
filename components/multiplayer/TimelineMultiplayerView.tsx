"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import TimelinePlacementBoard from "@/components/TimelinePlacementBoard";

type Room = {
  id: string;
  host_id: string;
  status: "waiting" | "playing" | "finished";
  question_ids: string[];
  current_question_index: number;
};

type Participant = {
  id: string;
  user_id: string;
  user_name: string;
  score: number;
};

type TimelineEvent = {
  id: string;
  title: string;
  description: string | null;
  year: number;
  image_url: string | null;
  category: string | null;
  fun_fact: string | null;
};

function calculateTimelineScore(guessedYear: number, realYear: number) {
  const diff = Math.abs(guessedYear - realYear);
  return Math.max(0, 200 - diff);
}

export default function TimelineMultiplayerView({
  room,
  participants,
}: {
  room: Room;
  participants: Participant[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [event, setEvent] = useState<TimelineEvent | null>(null);
  const [guessedYear, setGuessedYear] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [showReveal, setShowReveal] = useState(false);
  const [answersCount, setAnswersCount] = useState(0);
  const [bonusPop, setBonusPop] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      setEvent(null);
      setGuessedYear(null);
      setAnswered(false);
      setFeedback(null);
      setTimeLeft(10);
      setShowReveal(false);
      setAnswersCount(0);
      setBonusPop(null);

      const eventId = room.question_ids?.[room.current_question_index];

      if (!eventId) {
        setFeedback("Aucun événement trouvé pour cette manche.");
        return;
      }

      const { data, error } = await supabase
        .from("timeline_events")
        .select("id, title, description, year, image_url, category, fun_fact")
        .eq("id", eventId)
        .single();

      if (error || !data) {
        setFeedback("Impossible de charger l’événement.");
        return;
      }

      setEvent(data as TimelineEvent);
    }

    loadEvent();
  }, [room.current_question_index, room.question_ids, supabase]);

  useEffect(() => {
    if (!event || showReveal || room.status !== "playing") return;

    const interval = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [event, showReveal, room.status]);

  useEffect(() => {
    if (!room.id || !event || showReveal) return;

    async function loadAnswersCount() {
      const { count } = await supabase
        .from("multiplayer_timeline_answers")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("event_index", room.current_question_index);

      setAnswersCount(count ?? 0);
    }

    loadAnswersCount();

    const channel = supabase
      .channel(`timeline-answers-${room.id}-${room.current_question_index}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "multiplayer_timeline_answers",
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
  }, [room.id, room.current_question_index, event, showReveal, supabase]);

  useEffect(() => {
    if (!event || showReveal || participants.length === 0) return;

    if (answersCount >= participants.length) {
      setTimeLeft(0);
    }
  }, [answersCount, participants.length, event, showReveal]);

  useEffect(() => {
    if (!event || timeLeft > 0) return;

    setShowReveal(true);
  }, [timeLeft, event]);

  useEffect(() => {
    if (!showReveal) return;

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
  }, [showReveal, room, supabase]);

  async function submitYear() {
    if (!event || guessedYear === null || answered || showReveal) return;

    setAnswered(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFeedback("Tu dois être connecté pour répondre.");
      return;
    }

    const { count: previousAnswers } = await supabase
      .from("multiplayer_timeline_answers")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("event_index", room.current_question_index);

    const difference = Math.abs(guessedYear - event.year);
    const basePoints = calculateTimelineScore(guessedYear, event.year);
    const speedBonus = (previousAnswers ?? 0) === 0 && basePoints > 0 ? 50 : 0;
    const points = basePoints + speedBonus;

    const { error: answerError } = await supabase
      .from("multiplayer_timeline_answers")
      .insert({
        room_id: room.id,
        user_id: user.id,
        event_index: room.current_question_index,
        guessed_year: guessedYear,
        correct_year: event.year,
        difference,
        speed_bonus: speedBonus,
        points,
      });

    if (answerError) {
      setFeedback("Réponse déjà envoyée.");
      return;
    }

    const { data: allMyAnswers } = await supabase
      .from("multiplayer_timeline_answers")
      .select("points")
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    const totalScore = (allMyAnswers ?? []).reduce(
      (sum, answer) => sum + (answer.points ?? 0),
      0
    );

    await supabase
      .from("multiplayer_participants")
      .update({ score: totalScore })
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    if (speedBonus > 0) {
      setBonusPop(`+${speedBonus} ⚡`);
      setTimeout(() => setBonusPop(null), 1200);
    }

    setFeedback(
      `Réponse envoyée : ${guessedYear} · ${basePoints} pts${
        speedBonus ? ` +${speedBonus} bonus vitesse ⚡` : ""
      }`
    );
  }

  if (!event) {
    return (
      <div className="mt-8 rounded-3xl border border-gray-800 bg-gray-950 p-6">
        Chargement de l’événement...
      </div>
    );
  }

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
            Événement {room.current_question_index + 1} /{" "}
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

        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
          {event.category && (
            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs font-bold text-gray-400">
              {event.category}
            </span>
          )}

          <h2 className="mt-3 text-3xl font-black text-white">
            {event.title}
          </h2>

          {event.description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {event.description}
            </p>
          )}
        </div>

        <TimelinePlacementBoard
        event={event}
        minYear={-3000}
        maxYear={2026}
        selectedYear={guessedYear}
        correctYear={event.year}
        disabled={answered || showReveal}
        revealed={showReveal}
        onChange={setGuessedYear}
          />

        {!answered && !showReveal && (
          <button
            type="button"
            onClick={submitYear}
            disabled={guessedYear === null}
            className="mt-4 w-full rounded-xl bg-amber-500 py-4 text-base font-black text-gray-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
          >
            Valider ma position
          </button>
        )}

        <p className="mt-3 text-center text-xs text-gray-500">
          Score : 200 - écart en années. Bonus +50 au premier joueur qui répond.
        </p>

        {(answered || showReveal) && (
          <div className="mt-6 space-y-3">
            {feedback && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-300">
                {feedback}
              </div>
            )}

            {showReveal && (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
                <p className="text-sm font-black text-green-300">
                  Bonne année : {event.year}
                </p>

                {event.fun_fact && (
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">
                    💡 {event.fun_fact}
                  </p>
                )}
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
          {showReveal ? "Classement après l’événement" : "Classement live"}
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