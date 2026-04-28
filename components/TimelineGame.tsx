"use client";

import { useState, useRef } from "react";
import type { TimelineEvent } from "@/lib/types";
import { calculateScore } from "@/lib/timeline";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlacementResult = { event: TimelineEvent; guessedYear: number; score: number };
type PinAnim = "idle" | "drop" | "shake";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeline(events: TimelineEvent[]) {
  const years   = events.map((e) => e.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const range   = maxYear - minYear || 100;
  const pad     = Math.round(range * 0.2);
  const start   = minYear - pad;
  const end     = maxYear + pad;
  const span    = end - start;
  const step    = span > 400 ? 100 : 50;
  const marks: number[] = [];
  const first = Math.ceil(start / step) * step;
  for (let y = first; y <= end; y += step) marks.push(y);
  return { start, span, marks };
}

function pct(year: number, start: number, span: number): number {
  return Math.max(0, Math.min(100, ((year - start) / span) * 100));
}

function proxied(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http")
    ? `/api/image-proxy?url=${encodeURIComponent(url)}`
    : url;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_H     = 360;
const PIN_LINE_H = 42;
const BAR_H      = 24;
const ZONE_H     = 200;
const BAR_TOP    = 115;

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const COLORS = ["#f59e0b", "#fcd34d", "#fb923c", "#fbbf24", "#ffffff"];
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id:    i,
    x:     Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.7,
    size:  6 + Math.random() * 8,
    round: i % 3 !== 0,
  }));

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 30 }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position:     "absolute",
            left:         `${p.x}%`,
            top:          -20,
            width:        p.size,
            height:       p.size,
            background:   p.color,
            borderRadius: p.round ? "50%" : 2,
            animation:    `confetti-fall 1.5s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Dashed connector ─────────────────────────────────────────────────────────

function DashedLine({ fromPct, toPct }: { fromPct: number; toPct: number }) {
  const left  = Math.min(fromPct, toPct);
  const right = Math.max(fromPct, toPct);
  const width = right - left;
  if (width < 0.5) return null;
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left:            `${left}%`,
        top:             0,
        width:           `${width}%`,
        height:          3,
        borderTop:       "3px dashed rgba(251,191,36,0.55)",
        transformOrigin: fromPct < toPct ? "left center" : "right center",
        animation:       "dash-draw 0.55s ease-out both",
      }}
    />
  );
}

// ─── Player pin ───────────────────────────────────────────────────────────────

function PlayerPin({
  p,
  year,
  animState,
  imageUrl,
  title,
}: {
  p:         number;
  year:      number;
  animState: PinAnim;
  imageUrl:  string | null;
  title:     string;
}) {
  const src = proxied(imageUrl);
  const anim =
    animState === "drop"
      ? "pin-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) both"
      : animState === "shake"
      ? "pin-shake 0.35s cubic-bezier(0.36,0.07,0.19,0.97) both"
      : undefined;

  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col items-center"
      style={{
        left:            `${p}%`,
        bottom:          0,
        transform:       "translateX(-50%)",
        transformOrigin: "bottom center",
        animation:       anim,
      }}
    >
      <span
        className="mb-1.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-sm font-black text-amber-400"
        style={{ background: "rgba(3,7,18,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
      >
        {year}
      </span>

      {/* Head */}
      <div
        style={{
          width:        32,
          height:       32,
          borderRadius: "50%",
          border:       "2.5px solid #f59e0b",
          boxShadow:    "0 0 0 3px rgba(245,158,11,0.25), 0 4px 14px rgba(245,158,11,0.45)",
          overflow:     "hidden",
          background:   "#78350f",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          flexShrink:   0,
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", lineHeight: 1 }}>
            {title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Stem */}
      <div
        style={{
          width:      3,
          height:     PIN_LINE_H,
          background: "linear-gradient(to bottom, #f59e0b, #78350f)",
        }}
      />
    </div>
  );
}

// ─── True answer pin ──────────────────────────────────────────────────────────

function TruePin({ p, year, title }: { p: number; year: number; title: string }) {
  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-center"
      style={{
        left:            `${p}%`,
        bottom:          0,
        transform:       "translateX(-50%)",
        transformOrigin: "bottom center",
        animation:       "pin-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <div className="mb-1.5 flex flex-col items-center gap-0.5">
        <span
          className="max-w-[140px] truncate whitespace-nowrap rounded-lg px-2 py-0.5 text-center text-xs font-semibold text-green-300"
          style={{ background: "rgba(3,7,18,0.95)", boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
        >
          {title}
        </span>
        <span
          className="whitespace-nowrap rounded-lg px-2 py-0.5 text-sm font-black text-green-400"
          style={{ background: "rgba(3,7,18,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
        >
          {year}
        </span>
      </div>
      <div
        style={{
          width:        32,
          height:       32,
          borderRadius: "50%",
          background:   "#22c55e",
          border:       "2.5px solid #fff",
          boxShadow:    "0 0 0 3px rgba(34,197,94,0.3), 0 4px 14px rgba(34,197,94,0.6)",
          flexShrink:   0,
        }}
      />
      <div style={{ width: 3, height: PIN_LINE_H, background: "linear-gradient(to bottom, #22c55e, #14532d)" }} />
    </div>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  flipped,
  score,
  yearDiff,
  exiting,
  entering,
  onNext,
  isLastCard,
}: {
  event:      TimelineEvent;
  flipped:    boolean;
  score:      number | null;
  yearDiff:   number | null;
  exiting:    boolean;
  entering:   boolean;
  onNext:     () => void;
  isLastCard: boolean;
}) {
  const [hover, setHover] = useState(false);
  const src = proxied(event.image_url);
  const isAnimating = exiting || entering;
  console.log("[EventCard] image_url:", event.image_url, "→ proxied src:", src);

  const cardTransform = flipped
    ? "rotateY(180deg)"
    : hover
    ? "rotateX(0deg) translateY(-4px)"
    : "rotateX(3deg)";

  const cardTransition = isAnimating
    ? "none"
    : flipped
    ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1)"
    : "transform 0.25s ease, box-shadow 0.25s ease";

  const cardAnimation = exiting
    ? "card-exit 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards"
    : entering
    ? "card-enter 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards"
    : undefined;

  const backBg =
    yearDiff === 0           ? "linear-gradient(135deg,#052e16,#14532d)"
    : (yearDiff ?? 999) <= 20  ? "linear-gradient(135deg,#052e16,#166534)"
    : (yearDiff ?? 999) <= 100 ? "linear-gradient(135deg,#451a03,#78350f)"
    :                            "linear-gradient(135deg,#450a0a,#7f1d1d)";

  return (
    <div style={{ perspective: "1000px", perspectiveOrigin: "center bottom" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position:       "relative",
          height:         CARD_H,
          transformStyle: "preserve-3d",
          transition:     cardTransition,
          transform:      cardTransform,
          animation:      cardAnimation,
          borderRadius:   16,
          boxShadow:      hover && !flipped
            ? "0 24px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.15)"
            : "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── FRONT ── */}
        <div
          style={{
            position:             "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backfaceVisibility:         "hidden",
            WebkitBackfaceVisibility:   "hidden",
            borderRadius:         16,
            overflow:             "hidden",
            border:               "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Background: image or placeholder */}
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={event.title}
              style={{
                position:   "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                width:      "100%",
                height:     "100%",
                objectFit:  "cover",
                transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                transform:  hover ? "scale(1.04)" : "scale(1)",
              }}
            />
          ) : (
            <div
              style={{
                position:       "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                background:     "linear-gradient(135deg,#1f2937 0%,#111827 100%)",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            12,
              }}
            >
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3"  y1="10" x2="21" y2="10" />
              </svg>
              {event.category && (
                <span style={{ border: "1px solid #374151", borderRadius: 999, padding: "2px 12px", fontSize: 12, color: "#6b7280" }}>
                  {event.category}
                </span>
              )}
            </div>
          )}

          {/* Gradient overlay so text stays readable */}
          <div
            style={{
              position:   "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: src
                ? "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)"
                : "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)",
              pointerEvents: "none",
            }}
          />

          {/* Text overlay — floats at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              padding: "20px 24px 24px",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
              {event.category && (
                <span
                  style={{
                    border:       "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 999,
                    padding:      "2px 10px",
                    fontSize:     11,
                    color:        "rgba(255,255,255,0.65)",
                  }}
                >
                  {event.category}
                </span>
              )}
              <span style={{ fontSize: 13, letterSpacing: "0.1em", color: "#f59e0b" }}>
                {"★".repeat(event.difficulty)}
                <span style={{ color: "rgba(255,255,255,0.14)" }}>{"★".repeat(3 - event.difficulty)}</span>
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.25 }}>
              {event.title}
            </h2>
            {event.description && (
              <p
                style={{
                  marginTop:  8,
                  fontSize:   13,
                  lineHeight: 1.5,
                  color:      "rgba(255,255,255,0.62)",
                  overflow:   "hidden",
                  maxHeight:  "3em",
                }}
              >
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* ── BACK ── */}
        <div
          style={{
            position:                   "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backfaceVisibility:         "hidden",
            WebkitBackfaceVisibility:   "hidden",
            transform:                  "rotateY(180deg)",
            borderRadius:               16,
            overflow:                   "hidden",
            border:                     "1px solid rgba(255,255,255,0.08)",
            background:                 score !== null ? backBg : "#111827",
            display:                    "flex",
            flexDirection:              "column",
            padding:                    "24px 24px 20px",
          }}
        >
          {score !== null && yearDiff !== null && (
            <>
              {/* Score + emoji */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 40, lineHeight: 1 }}>
                  {score >= 900 ? "🎯" : score >= 600 ? "⭐" : "📍"}
                </span>
                <div style={{ lineHeight: 1 }}>
                  <span style={{ fontSize: 52, fontWeight: 900, color: "#fbbf24" }}>
                    {score}
                  </span>
                  <span style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", marginLeft: 5 }}>
                    / 1000
                  </span>
                </div>
              </div>

              {/* Year diff */}
              <p style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: "0 0 12px" }}>
                {yearDiff === 0 ? "Parfait !" : `À ${yearDiff} an${yearDiff > 1 ? "s" : ""} près`}
              </p>

              {/* Fun fact */}
              {event.fun_fact ? (
                <div style={{
                  flex:       1,
                  background: "rgba(245,158,11,0.1)",
                  border:     "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 12,
                  padding:    "12px 14px",
                  marginBottom: 14,
                  overflow:   "hidden",
                }}>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", margin: 0, lineHeight: 1.55 }}>
                    💡 {event.fun_fact}
                  </p>
                </div>
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {/* Next button */}
              <button
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                style={{
                  background:   "#f59e0b",
                  borderRadius: 12,
                  padding:      "13px 0",
                  width:        "100%",
                  fontWeight:   700,
                  fontSize:     15,
                  color:        "#030712",
                  cursor:       "pointer",
                  border:       "none",
                  flexShrink:   0,
                }}
              >
                {isLastCard ? "Voir les résultats →" : "Suivant →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Final screen ─────────────────────────────────────────────────────────────

function FinalScreen({ results, difficulty }: { results: PlacementResult[]; difficulty: 1 | 2 | 3 }) {
  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const maxScore   = results.length * 1000;
  const diffLabel  = difficulty === 1 ? "Débutant" : difficulty === 2 ? "Pro" : "Expert";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-widest text-gray-500">Score final · {diffLabel}</p>
        <p className="text-6xl font-black text-white">
          {totalScore}
          <span className="text-2xl font-normal text-gray-600"> / {maxScore}</span>
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {results.map((r, i) => {
          const diff = Math.abs(r.guessedYear - r.event.year);
          return (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{r.event.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {r.guessedYear} → {r.event.year}{" "}
                  {diff === 0 ? (
                    <span className="text-green-400">parfait !</span>
                  ) : (
                    <span className={diff <= 20 ? "text-green-400" : diff <= 100 ? "text-amber-400" : "text-red-400"}>
                      {diff} an{diff > 1 ? "s" : ""} d&apos;écart
                    </span>
                  )}
                </p>
              </div>
              <span className={`shrink-0 text-xl font-black ${
                r.score >= 900 ? "text-green-400" :
                r.score >= 700 ? "text-amber-400" :
                r.score >= 400 ? "text-orange-400" : "text-red-400"
              }`}>
                {r.score}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <a
          href={`/timeline?mode=placement&difficulty=${difficulty}`}
          className="rounded-xl bg-amber-500 px-8 py-3 font-bold text-gray-950 transition-colors hover:bg-amber-400"
        >
          Rejouer
        </a>
        <a
          href="/timeline"
          className="rounded-xl border border-gray-700 px-8 py-3 font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
        >
          Changer de mode
        </a>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimelineGame({
  events,
  difficulty,
}: {
  events:     TimelineEvent[];
  difficulty: 1 | 2 | 3;
}) {
  const [step, setStep]               = useState(0);
  const [guessedYear, setGuessedYear] = useState<number | null>(null);
  const [validated, setValidated]     = useState(false);
  const [results, setResults]         = useState<PlacementResult[]>([]);
  const [pinAnim, setPinAnim]         = useState<PinAnim>("idle");
  const [pinKey, setPinKey]           = useState(0);
  const [exiting, setExiting]         = useState(false);
  const [entering, setEntering]       = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  const total = events.length;
  const event = events[step];
  const done  = results.length === total;

  const { start, span, marks } = getTimeline(events);

  // ── Interactions ─────────────────────────────────────────────────────────────

  function handleZoneClick(e: React.MouseEvent<HTMLDivElement>) {
    if (validated || !zoneRef.current) return;
    const rect  = zoneRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const year  = Math.round(start + ratio * span);

    if (guessedYear !== null) {
      setPinAnim("shake");
      setPinKey((k) => k + 1);
      setTimeout(() => setPinAnim("idle"), 400);
    } else {
      setPinAnim("drop");
      setPinKey((k) => k + 1);
      setTimeout(() => setPinAnim("idle"), 550);
    }
    setGuessedYear(year);
  }

  function handleValidate() {
    if (guessedYear === null) return;
    setValidated(true);
  }

  function handleNext() {
    if (guessedYear === null) return;
    const score = calculateScore(guessedYear, event.year);
    setExiting(true);
    setTimeout(() => {
      setResults((prev) => [...prev, { event, guessedYear: guessedYear!, score }]);
      if (step < total - 1) {
        setStep((s) => s + 1);
        setGuessedYear(null);
        setValidated(false);
        setPinAnim("idle");
        setPinKey(0);
        setExiting(false);
        setEntering(true);
        setTimeout(() => setEntering(false), 500);
      }
    }, 450);
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const runningScore = results.reduce((s, r) => s + r.score, 0);
  const currentScore = validated && guessedYear !== null ? calculateScore(guessedYear, event.year) : null;
  const yearDiff     = validated && guessedYear !== null ? Math.abs(guessedYear - event.year) : null;
  const guessedPct   = guessedYear !== null ? pct(guessedYear, start, span) : null;
  const truePct      = pct(event.year, start, span);
  const showConfetti = validated && yearDiff !== null && yearDiff <= 20;

  if (done) return <FinalScreen results={results} difficulty={difficulty} />;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes pin-drop {
          0%   { transform: translateX(-50%) translateY(-70px); opacity: 0; }
          55%  { transform: translateX(-50%) translateY(7px);   opacity: 1; }
          75%  { transform: translateX(-50%) translateY(-3px); }
          100% { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes pin-pop {
          0%   { transform: translateX(-50%) scale(0);    opacity: 0; }
          55%  { transform: translateX(-50%) scale(1.3);  opacity: 1; }
          100% { transform: translateX(-50%) scale(1);    opacity: 1; }
        }
        @keyframes pin-shake {
          0%,100% { transform: translateX(-50%) rotate(0deg); }
          20%     { transform: translateX(-50%) rotate(-9deg); }
          40%     { transform: translateX(-50%) rotate(8deg); }
          60%     { transform: translateX(-50%) rotate(-5deg); }
          80%     { transform: translateX(-50%) rotate(4deg); }
        }
        @keyframes dash-draw {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes confetti-fall {
          0%   { transform: translateY(0)     rotate(0deg)   scale(1);   opacity: 1; }
          100% { transform: translateY(360px) rotate(720deg) scale(0.3); opacity: 0; }
        }
        @keyframes card-exit {
          from { transform: translateX(0)     rotateY(180deg); opacity: 1; }
          to   { transform: translateX(-130%) rotateY(195deg); opacity: 0; }
        }
        @keyframes card-enter {
          from { transform: translateX(130%)  rotateY(-15deg); opacity: 0; }
          to   { transform: translateX(0)     rotateY(0deg);   opacity: 1; }
        }
      `}</style>

      <div className="flex w-full flex-col pb-8">

        {/* Progress bar */}
        <div className="mx-auto w-full max-w-5xl px-4 pt-6">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-white">
              Événement {step + 1}
              <span className="font-normal text-white/40"> / {total}</span>
            </span>
            <span className="text-sm font-semibold text-amber-400">{runningScore} pts</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{
                width:      `${(step / total) * 100}%`,
                transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            />
          </div>
        </div>

        {/* Event card */}
        <div className="mx-auto mt-5 w-full max-w-5xl px-4">
          <EventCard
            event={event}
            flipped={validated}
            score={currentScore}
            yearDiff={yearDiff}
            exiting={exiting}
            entering={entering}
            onNext={handleNext}
            isLastCard={step === total - 1}
          />
        </div>

        {/* Timeline zone */}
        <div className="mt-7 w-full overflow-x-auto">
          <div className="min-w-[580px] px-8">

            {/* Instruction / live year */}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {!validated && (guessedYear === null
                  ? "Clique sur la ligne du temps pour placer l'événement"
                  : "Reclique pour ajuster, puis valide")}
              </p>
              {guessedYear !== null && !validated && (
                <span className="text-3xl font-black tracking-tight text-amber-400">
                  {guessedYear}
                </span>
              )}
            </div>

            {/* 2.5D wrapper */}
            <div style={{ perspective: "800px", perspectiveOrigin: "50% 80%" }}>
              <div
                ref={zoneRef}
                className={`relative w-full select-none ${!validated ? "cursor-crosshair" : ""}`}
                style={{ height: ZONE_H, touchAction: "manipulation", transformStyle: "preserve-3d" }}
                onClick={handleZoneClick}
              >
                {/* Confetti */}
                {showConfetti && <Confetti />}

                {/* 2.5D amber bar */}
                <div
                  className="pointer-events-none absolute w-full"
                  style={{
                    top:             BAR_TOP,
                    height:          BAR_H,
                    borderRadius:    12,
                    transform:       "rotateX(25deg)",
                    transformOrigin: "center center",
                    background:      "linear-gradient(to right, #78350f 0%, #b45309 25%, #f59e0b 55%, #fcd34d 75%, #f59e0b 100%)",
                    boxShadow:       "0 8px 32px rgba(245,158,11,0.35), 0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.35)",
                    overflow:        "hidden",
                  }}
                >
                  {/* Glass reflection */}
                  <div
                    style={{
                      position:     "absolute",
                      top: 0, left: 0, right: 0,
                      height:       "45%",
                      background:   "linear-gradient(to bottom, rgba(255,255,255,0.32), rgba(255,255,255,0))",
                      borderRadius: "12px 12px 0 0",
                      pointerEvents: "none",
                    }}
                  />
                  {/* Tick marks */}
                  {marks.map((y) => (
                    <div
                      key={y}
                      className="absolute inset-y-0"
                      style={{ left: `${pct(y, start, span)}%`, width: 1, background: "rgba(0,0,0,0.3)" }}
                    />
                  ))}
                </div>

                {/* 3D pillar ticks above bar */}
                {marks.map((y) => (
                  <div
                    key={y}
                    className="pointer-events-none absolute"
                    style={{
                      left:            `${pct(y, start, span)}%`,
                      top:             BAR_TOP - 22,
                      width:           2,
                      height:          22,
                      transform:       "translateX(-50%) rotateX(25deg)",
                      transformOrigin: "bottom center",
                      background:      "linear-gradient(to top, #d97706, rgba(217,119,6,0))",
                    }}
                  />
                ))}

                {/* Year labels */}
                <div
                  className="pointer-events-none absolute w-full"
                  style={{ top: BAR_TOP + BAR_H + 10 }}
                >
                  {marks.map((y) => (
                    <span
                      key={y}
                      className="absolute -translate-x-1/2 text-xs font-medium text-gray-500"
                      style={{ left: `${pct(y, start, span)}%` }}
                    >
                      {y}
                    </span>
                  ))}
                </div>

                {/* Pin anchor — bottom of this div = bar center */}
                <div
                  className="pointer-events-none absolute w-full"
                  style={{ bottom: ZONE_H - (BAR_TOP + BAR_H / 2), left: 0 }}
                >
                  {guessedPct !== null && (
                    <PlayerPin
                      key={pinKey}
                      p={guessedPct}
                      year={guessedYear!}
                      animState={pinAnim}
                      imageUrl={event.image_url}
                      title={event.title}
                    />
                  )}

                  {validated && guessedPct !== null && (
                    <DashedLine fromPct={guessedPct} toPct={truePct} />
                  )}

                  {validated && (
                    <TruePin p={truePct} year={event.year} title={event.title} />
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            {validated && (
              <div className="mt-1 flex gap-5 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
                  Ta réponse ({guessedYear})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                  Vrai ({event.year})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Feedback / validate button */}
        <div className="mx-auto mt-5 w-full max-w-5xl px-4">
          {validated ? (
            <p className="text-center text-sm text-gray-500">
              <span className="font-bold text-white">{event.title}</span>
              {" — "}
              <span className="font-bold text-amber-400">{event.year}</span>
            </p>
          ) : (
            <button
              onClick={handleValidate}
              disabled={guessedYear === null}
              className="w-full rounded-xl bg-amber-500 py-4 text-base font-bold text-gray-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
            >
              Valider ma position
            </button>
          )}
        </div>
      </div>
    </>
  );
}
