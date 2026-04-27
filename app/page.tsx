import Link from "next/link";
import AuthButton from "@/components/AuthButton";

function IconScroll() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconBar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-950 px-4">
      {/* Top-right auth */}
      <div className="absolute right-4 top-4 z-20">
        <AuthButton />
      </div>

      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Amber ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-[500px] w-[500px] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex max-w-lg flex-col items-center gap-7 text-center">
        {/* Badge */}
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
          Histoire &amp; Découverte
        </span>

        {/* Title block */}
        <div className="flex flex-col gap-3">
          <h1 className="text-7xl font-black tracking-tighter text-white sm:text-8xl">
            Histo<span className="text-amber-400">Guess</span>
          </h1>
          <p className="text-xl font-medium text-gray-300">
            Sauras-tu repérer l&apos;anachronisme&nbsp;?
          </p>
        </div>

        {/* Description */}
        <p className="max-w-sm leading-relaxed text-gray-400">
          Chaque image cache un détail qui n&apos;appartient pas à son époque.
          Trouve l&apos;intrus et prouve que tu maîtrises l&apos;Histoire.
        </p>

        {/* CTAs */}
        <div className="mt-1 flex flex-col items-center gap-3">
          <Link
            href="/game"
            className="group inline-flex items-center gap-2 rounded-full bg-amber-500 px-10 py-4 text-lg font-bold text-gray-950 shadow-lg shadow-amber-500/20 transition-all duration-200 hover:bg-amber-400 hover:shadow-amber-400/30 active:scale-95"
          >
            Jouer
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link
            href="/quiz"
            className="group inline-flex items-center gap-2 rounded-full border border-gray-700 px-10 py-3.5 text-base font-semibold text-gray-300 transition-all duration-200 hover:border-gray-500 hover:text-white active:scale-95"
          >
            Mode Quiz
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-8 border-t border-gray-800 pt-7">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-amber-400">
              <IconScroll />
            </span>
            <span className="text-lg font-bold text-white">6+</span>
            <span className="text-xs uppercase tracking-wider text-gray-500">Questions</span>
          </div>

          <div className="h-8 w-px bg-gray-800" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-amber-400">
              <IconLayers />
            </span>
            <span className="text-sm font-bold text-white">Anachronisme</span>
            <span className="text-xs uppercase tracking-wider text-gray-500">Mode</span>
          </div>

          <div className="h-8 w-px bg-gray-800" />

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-amber-400">
              <IconBar />
            </span>
            <span className="text-sm font-bold text-white">Facile → Expert</span>
            <span className="text-xs uppercase tracking-wider text-gray-500">Difficulté</span>
          </div>
        </div>
      </div>
    </main>
  );
}
