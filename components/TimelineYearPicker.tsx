"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TimelineYearPickerProps = {
  years: number[];
  selectedYear: number | null;
  correctYear?: number;
  disabled?: boolean;
  revealed?: boolean;
  onChange: (year: number) => void;
};

function getTimeline(years: number[]) {
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const range = maxYear - minYear || 100;
  const pad = Math.max(50, Math.round(range * 0.25));
  const start = minYear - pad;
  const end = maxYear + pad;
  const span = end - start;
  const step = span > 600 ? 100 : span > 250 ? 50 : 25;

  const marks: number[] = [];
  const first = Math.ceil(start / step) * step;

  for (let y = first; y <= end; y += step) {
    marks.push(y);
  }

  return { start, end, span, marks };
}

function pct(year: number, start: number, span: number) {
  return Math.max(0, Math.min(100, ((year - start) / span) * 100));
}

export default function TimelineYearPicker({
  years,
  selectedYear,
  correctYear,
  disabled = false,
  revealed = false,
  onChange,
}: TimelineYearPickerProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [inputYear, setInputYear] = useState("");

  const safeYears = years.length > 0 ? years : [0, 100];
  const { start, end, span, marks } = useMemo(
    () => getTimeline(safeYears),
    [safeYears]
  );

  const fallbackYear = Math.round((start + end) / 2);
  const currentYear = selectedYear ?? fallbackYear;

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    setInputYear(selectedYear ? String(selectedYear) : "");
  }, [selectedYear]);

  function clampYear(year: number) {
    return Math.max(start, Math.min(end, year));
  }

  function handleDesktopClick(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !zoneRef.current) return;

    const rect = zoneRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const year = Math.round(start + ratio * span);

    onChange(year);
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !zoneRef.current) return;

    const rect = zoneRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const year = Math.round(start + ratio * span);

    setHoverYear(year);
  }

  function handleInputChange(value: string) {
    setInputYear(value);

    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      onChange(clampYear(parsed));
    }
  }

  const selectedPct = selectedYear !== null ? pct(selectedYear, start, span) : null;
  const correctPct =
    revealed && typeof correctYear === "number"
      ? pct(correctYear, start, span)
      : null;

  if (isMobile) {
    return (
      <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-5">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">
            Ton estimation
          </p>

          <p className="mt-2 text-6xl font-black text-amber-400">
            {currentYear}
          </p>
        </div>

        <input
          type="range"
          min={start}
          max={end}
          value={currentYear}
          disabled={disabled}
          onChange={(event) => onChange(parseInt(event.target.value, 10))}
          className="mt-7 w-full accent-amber-500"
        />

        <div className="mt-5 grid grid-cols-4 gap-2">
          {[-10, -1, 1, 10].map((delta) => (
            <button
              key={delta}
              type="button"
              disabled={disabled}
              onClick={() => onChange(clampYear(currentYear + delta))}
              className="rounded-2xl border border-gray-700 bg-gray-950 py-3 text-sm font-black text-white transition hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        <input
          type="number"
          value={inputYear}
          disabled={disabled}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder="Ou tape l’année"
          className="mt-4 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-center text-lg font-black text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none disabled:opacity-40"
        />

        {revealed && typeof correctYear === "number" && (
          <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-center text-sm font-bold text-green-300">
            Bonne année : {correctYear}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500">
          Clique sur la ligne du temps
        </p>

        <p className="text-3xl font-black text-amber-400">
          {hoverYear ?? selectedYear ?? "—"}
        </p>
      </div>

      <div
        ref={zoneRef}
        onClick={handleDesktopClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverYear(null)}
        className={`relative h-40 select-none ${disabled ? "cursor-default" : "cursor-crosshair"}`}
      >
        <div className="absolute left-0 right-0 top-1/2 h-5 -translate-y-1/2 rounded-full bg-gradient-to-r from-amber-900 via-amber-500 to-yellow-300 shadow-lg shadow-amber-500/20" />

        {marks.map((mark) => (
          <div
            key={mark}
            className="absolute top-1/2 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pct(mark, start, span)}%` }}
          >
            <div className="h-9 w-0.5 -translate-y-1/2 bg-black/40" />
            <span className="mt-3 text-xs font-bold text-gray-500">
              {mark}
            </span>
          </div>
        ))}

        {hoverYear !== null && !disabled && (
          <div
            className="absolute top-0 z-20 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-gray-950 shadow-lg"
            style={{ left: `${pct(hoverYear, start, span)}%` }}
          >
            {hoverYear}
          </div>
        )}

        {selectedPct !== null && (
          <div
            className="absolute top-1/2 z-30 flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${selectedPct}%` }}
          >
            <span className="mb-2 rounded-xl bg-gray-950 px-3 py-1 text-sm font-black text-amber-400 shadow-lg">
              {selectedYear}
            </span>
            <div className="h-10 w-1 rounded-full bg-amber-400" />
            <div className="h-7 w-7 rounded-full border-4 border-white bg-amber-500 shadow-lg shadow-amber-500/40" />
          </div>
        )}

        {correctPct !== null && (
          <div
            className="absolute top-1/2 z-40 flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${correctPct}%` }}
          >
            <span className="mb-2 rounded-xl bg-green-950 px-3 py-1 text-sm font-black text-green-300 shadow-lg">
              {correctYear}
            </span>
            <div className="h-10 w-1 rounded-full bg-green-400" />
            <div className="h-7 w-7 rounded-full border-4 border-white bg-green-500 shadow-lg shadow-green-500/40" />
          </div>
        )}
      </div>

      <input
        type="number"
        value={inputYear}
        disabled={disabled}
        onChange={(event) => handleInputChange(event.target.value)}
        placeholder="Ou tape l’année directement..."
        className="mt-4 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-center text-lg font-black text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}