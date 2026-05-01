"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TimelineEventLike = {
  title: string;
  year: number;
  image_url?: string | null;
};

type PinAnim = "idle" | "drop" | "shake";

type GhostPin = {
  user_id: string;
  user_name: string;
  guessed_year: number;
};

function pct(year: number, start: number, span: number) {
  return Math.max(0, Math.min(100, ((year - start) / span) * 100));
}

function getMarks(start: number, end: number) {
  return [start, -3000, -2000, -1000, 0, 1000, 2000, end].filter(
    (year, index, arr) =>
      year >= start && year <= end && arr.indexOf(year) === index
  );
}

function proxied(url?: string | null) {
  if (!url) return null;
  return url.startsWith("http")
    ? `/api/image-proxy?url=${encodeURIComponent(url)}`
    : url;
}

function PlayerPin({
  p,
  year,
  imageUrl,
  title,
  animState,
}: {
  p: number;
  year: number;
  imageUrl?: string | null;
  title: string;
  animState: PinAnim;
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
      className="pointer-events-none absolute z-30 flex flex-col items-center"
      style={{
        left: `${p}%`,
        bottom: 0,
        transform: "translateX(-50%)",
        transformOrigin: "bottom center",
        animation: anim,
      }}
    >
      <span className="mb-1.5 whitespace-nowrap rounded-lg bg-gray-950/95 px-2 py-0.5 text-sm font-black text-amber-400 shadow-lg">
        {year}
      </span>

      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-[2.5px] border-amber-500 bg-amber-900 shadow-[0_0_0_3px_rgba(245,158,11,0.25),0_4px_14px_rgba(245,158,11,0.45)]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-black text-amber-300">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="h-[42px] w-[3px] bg-gradient-to-b from-amber-500 to-amber-900" />
    </div>
  );
}

function TruePin({ p, year }: { p: number; year: number }) {
  return (
    <div
      className="pointer-events-none absolute z-40 flex flex-col items-center"
      style={{
        left: `${p}%`,
        bottom: 0,
        transform: "translateX(-50%)",
        animation: "pin-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <span className="mb-1.5 whitespace-nowrap rounded-lg bg-gray-950/95 px-2 py-0.5 text-sm font-black text-green-400 shadow-lg">
        {year}
      </span>

      <div className="h-8 w-8 rounded-full border-[2.5px] border-white bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.3),0_4px_14px_rgba(34,197,94,0.6)]" />
      <div className="h-[42px] w-[3px] bg-gradient-to-b from-green-500 to-green-900" />
    </div>
  );
}

function GhostPin({
  p,
  year,
  name,
}: {
  p: number;
  year: number;
  name: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-center opacity-75"
      style={{
        left: `${p}%`,
        bottom: 0,
        transform: "translateX(-50%)",
        animation: "pin-pop 0.45s ease-out both",
      }}
    >
      <span className="mb-1.5 max-w-[100px] truncate rounded-lg bg-gray-950/90 px-2 py-0.5 text-xs font-bold text-gray-300">
        {name} · {year}
      </span>

      <div className="h-6 w-6 rounded-full border-2 border-gray-300 bg-gray-700" />
      <div className="h-[34px] w-[2px] bg-gradient-to-b from-gray-400 to-gray-800" />
    </div>
  );
}

function DashedLine({ fromPct, toPct }: { fromPct: number; toPct: number }) {
  const left = Math.min(fromPct, toPct);
  const width = Math.abs(toPct - fromPct);

  if (width < 0.5) return null;

  return (
    <div
      className="pointer-events-none absolute border-t-[3px] border-dashed border-amber-400/60"
      style={{
        left: `${left}%`,
        top: 0,
        width: `${width}%`,
        animation: "dash-draw 0.55s ease-out both",
      }}
    />
  );
}

export default function TimelinePlacementBoard({
  event,
  minYear,
  maxYear,
  selectedYear,
  correctYear,
  disabled,
  revealed,
  onChange,
  ghostPins = [],
}: {
  event: TimelineEventLike;
  minYear: number;
  maxYear: number;
  selectedYear: number | null;
  correctYear: number;
  disabled: boolean;
  revealed: boolean;
  onChange: (year: number) => void;
  ghostPins?: GhostPin[];
}) {
  const zoneRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [cursorRatio, setCursorRatio] = useState<number | null>(null);
  const [inputYear, setInputYear] = useState("");
  const [pinAnim, setPinAnim] = useState<PinAnim>("idle");
  const [pinKey, setPinKey] = useState(0);

  const start = minYear;
  const end = maxYear;
  const span = end - start || 1;

  const marks = useMemo(() => getMarks(start, end), [start, end]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    setInputYear(selectedYear === null ? "" : String(selectedYear));
  }, [selectedYear]);

  function placeYear(year: number) {
    const clamped = Math.max(start, Math.min(end, year));

    setPinAnim(selectedYear === null ? "drop" : "shake");
    setPinKey((k) => k + 1);
    setTimeout(() => setPinAnim("idle"), 550);

    onChange(clamped);
    setInputYear(String(clamped));
  }

  function handleZoneClick(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !zoneRef.current) return;

    const rect = zoneRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const year = Math.round(start + ratio * span);

    placeYear(year);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !zoneRef.current) return;

    const rect = zoneRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const year = Math.round(start + ratio * span);

    setCursorRatio(ratio);
    setHoverYear(year);
  }

  const selectedPct =
    selectedYear !== null ? pct(selectedYear, start, span) : null;

  const correctPct = pct(correctYear, start, span);

  return (
    <div className="mt-7 w-full">
      <style>{`
        @keyframes pin-drop {
          0% { transform: translateX(-50%) translateY(-70px); opacity: 0; }
          55% { transform: translateX(-50%) translateY(7px); opacity: 1; }
          75% { transform: translateX(-50%) translateY(-3px); }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }

        @keyframes pin-pop {
          0% { transform: translateX(-50%) scale(0); opacity: 0; }
          55% { transform: translateX(-50%) scale(1.2); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }

        @keyframes pin-shake {
          0%,100% { transform: translateX(-50%) rotate(0deg); }
          20% { transform: translateX(-50%) rotate(-9deg); }
          40% { transform: translateX(-50%) rotate(8deg); }
          60% { transform: translateX(-50%) rotate(-5deg); }
          80% { transform: translateX(-50%) rotate(4deg); }
        }

        @keyframes dash-draw {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        .tl-no-spin::-webkit-outer-spin-button,
        .tl-no-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .tl-no-spin {
          -moz-appearance: textfield;
        }

        .mobile-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          background: transparent;
          cursor: pointer;
        }

        .mobile-slider::-webkit-slider-runnable-track {
          height: 12px;
          background: #374151;
          border-radius: 999px;
        }

        .mobile-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #f59e0b;
          margin-top: -16px;
          box-shadow: 0 2px 12px rgba(245,158,11,0.55);
          border: 3px solid #fff;
        }
      `}</style>

      {isMobile && !revealed ? (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-2">
          <div className="text-center text-6xl font-black leading-none text-amber-400">
            {selectedYear ?? Math.round((start + end) / 2)}
          </div>

          <input
            type="range"
            min={start}
            max={end}
            value={selectedYear ?? Math.round((start + end) / 2)}
            disabled={disabled}
            onChange={(e) => placeYear(parseInt(e.target.value, 10))}
            className="mobile-slider"
          />

          <div className="flex gap-3">
            {([-10, -1, 1, 10] as const).map((delta) => (
              <button
                key={delta}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const current = selectedYear ?? Math.round((start + end) / 2);
                  placeYear(current + delta);
                }}
                className="min-w-[58px] rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 font-bold text-white disabled:opacity-30"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>
      ) : (
          <div className="overflow-visible">
              <div className="w-full px-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {revealed
                  ? "Résultat de la manche"
                  : selectedYear === null
                    ? "Clique sur la ligne du temps pour placer l’événement"
                    : "Reclique pour ajuster"}
              </p>

              {(hoverYear !== null || selectedYear !== null) && !revealed && (
                <span className="text-3xl font-black tracking-tight text-amber-400">
                  {hoverYear ?? selectedYear}
                </span>
              )}
            </div>

            <div
              ref={zoneRef}
              className={`relative h-[220px] w-full select-none rounded-3xl bg-gradient-to-b from-gray-950/20 to-gray-950/70 px-2 ${
                disabled ? "" : "cursor-crosshair"
              }`}
              onClick={handleZoneClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                setCursorRatio(null);
                setHoverYear(null);
              }}
            >
              {cursorRatio !== null && !disabled && (
                <>
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-20 w-[2px] bg-amber-500/70"
                    style={{
                      left: `${cursorRatio * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute top-2 z-20 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-gray-950"
                    style={{
                      left: `${cursorRatio * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {hoverYear}
                  </div>
                </>
              )}

              {/* Major labels */}
              {/* Major labels */}
{marks.map((year) => {
  const position = pct(year, start, span);

  const alignClass =
    position <= 2
      ? "translate-x-0"
      : position >= 98
        ? "-translate-x-full"
        : "-translate-x-1/2";

  return (
    <div
      key={`major-${year}`}
      className="pointer-events-none absolute"
      style={{
        left: `${position}%`,
        top: 70,
      }}
    >
      <span
        className={`block whitespace-nowrap text-sm font-black text-gray-200 ${alignClass}`}
      >
        {year}
      </span>

      <div className="mx-auto mt-5 h-9 w-[2px] rounded-full bg-amber-300" />
    </div>
  );
})}

              {/* Main premium bar */}
              <div className="absolute left-2 right-2 top-[125px] h-8 overflow-hidden rounded-xl bg-gradient-to-r from-orange-700 via-amber-500 to-yellow-300 shadow-[0_0_35px_rgba(245,158,11,0.35)]">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
              </div>

              {/* Small ticks */}
              {Array.from({ length: 61 }, (_, i) => {
                const ratio = i / 60;
                const year = Math.round(start + ratio * span);
                const isMajor = marks.some((mark) => Math.abs(mark - year) < 45);

                return (
                  <div
                    key={`tick-${i}`}
                    className="pointer-events-none absolute rounded-full bg-amber-900/70"
                    style={{
                      left: `calc(0.5rem + ${ratio * 100}% - ${ratio}rem)`,
                      top: isMajor ? 112 : 128,
                      width: isMajor ? 2 : 1,
                      height: isMajor ? 38 : 16,
                      transform: "translateX(-50%)",
                    }}
                  />
                );
              })}

              <div className="pointer-events-none absolute bottom-[62px] left-0 w-full">
                {revealed &&
                  ghostPins.map((pin) => (
                    <GhostPin
                      key={pin.user_id}
                      p={pct(pin.guessed_year, start, span)}
                      year={pin.guessed_year}
                      name={pin.user_name}
                    />
                  ))}

                {selectedPct !== null && (
                  <PlayerPin
                    key={pinKey}
                    p={selectedPct}
                    year={selectedYear!}
                    imageUrl={event.image_url}
                    title={event.title}
                    animState={pinAnim}
                  />
                )}

                {revealed && selectedPct !== null && (
                  <DashedLine fromPct={selectedPct} toPct={correctPct} />
                )}

                {revealed && <TruePin p={correctPct} year={correctYear} />}
              </div>
            </div>

            {revealed && (
              <div className="mt-1 flex flex-wrap gap-5 text-xs text-gray-500">
                {selectedYear !== null && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
                    Ta réponse ({selectedYear})
                  </span>
                )}

                {ghostPins.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-gray-500" />
                    Autres joueurs
                  </span>
                )}

                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                  Vrai ({correctYear})
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {!isMobile && !revealed && (
        <div className="mx-auto mt-4 flex w-full max-w-xl items-center gap-3">
          <div className="h-px flex-1 bg-gray-800" />

          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            ou
          </span>

          <div className="h-px flex-1 bg-gray-800" />
        </div>
      )}

      {!isMobile && !revealed && (
        <div className="mx-auto mt-4 flex w-full justify-center">
          <input
            type="number"
            value={inputYear}
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value;
              setInputYear(value);

              const parsed = parseInt(value, 10);
              if (!Number.isNaN(parsed)) {
                placeYear(parsed);
              }
            }}
            placeholder="Ou tape l’année directement..."
            min={start}
            max={end}
            className="tl-no-spin w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-center text-white placeholder-gray-600 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-30"
          />
        </div>
      )}
    </div>
  );
}