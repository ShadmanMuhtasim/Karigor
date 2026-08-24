import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Total animation plays for ~2.6s, then triggers exit fade
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, 2600);

    // Call onComplete when exit fade finishes
    const finishTimer = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07162c] text-white select-none transition-all duration-700 ${
        isExiting ? 'animate-splash-exit' : ''
      }`}
    >
      {/* Background ambient radial lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.18)_0%,transparent_70%)] pointer-events-none" />

      {/* Main Animation Stage */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        
        {/* ── 4 Sky-Blue Satellite Circles Emerging in 4 Directions ── */}
        
        {/* 1. TOP: Hammer Symbol */}
        <div className="absolute opacity-0 animate-emerge-top z-10">
          <div className="w-14 h-14 rounded-full bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.7)] flex items-center justify-center border-2 border-sky-300">
            <svg
              className="w-7 h-7 text-white drop-shadow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Hammer icon */}
              <path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0-.83-.83-.83-2.17 0-3L12 9" />
              <path d="M17.64 4.36a3 3 0 0 0-4.24 0L12 5.76l4.24 4.24 1.4-1.4a3 3 0 0 0 0-4.24z" />
            </svg>
          </div>
        </div>

        {/* 2. BOTTOM: Lightning / Lightbulb Symbol */}
        <div className="absolute opacity-0 animate-emerge-bottom z-10">
          <div className="w-14 h-14 rounded-full bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.7)] flex items-center justify-center border-2 border-sky-300">
            <svg
              className="w-7 h-7 text-white drop-shadow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Lightning & Bulb icon */}
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>

        {/* 3. LEFT: Paint Brush / Roller Symbol */}
        <div className="absolute opacity-0 animate-emerge-left z-10">
          <div className="w-14 h-14 rounded-full bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.7)] flex items-center justify-center border-2 border-sky-300">
            <svg
              className="w-7 h-7 text-white drop-shadow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Paint brush / roller */}
              <rect width="18" height="6" x="3" y="3" rx="2" />
              <path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 1 2 2v2" />
              <rect width="4" height="6" x="16" y="15" rx="1" />
            </svg>
          </div>
        </div>

        {/* 4. RIGHT: Bolt Opener / Wrench / Spanner Symbol */}
        <div className="absolute opacity-0 animate-emerge-right z-10">
          <div className="w-14 h-14 rounded-full bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.7)] flex items-center justify-center border-2 border-sky-300">
            <svg
              className="w-7 h-7 text-white drop-shadow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Spanner / Wrench */}
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        </div>

        {/* ── Center Green Circle with Dynamic Spinning Crossed Tools ── */}
        <div className="relative z-20 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500 border-4 border-emerald-300 splash-glow flex items-center justify-center animate-splash-center">
            {/* Spinning Crossed Screwdriver & Wrench */}
            <div className="w-16 h-16 flex items-center justify-center animate-splash-spin">
              <svg
                className="w-12 h-12 text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Crossed Wrench & Screwdriver */}
                {/* Screwdriver diagonally */}
                <path d="M18 2l4 4-9.5 9.5a2 2 0 0 1-1.4.6H8v-3.1a2 2 0 0 1 .6-1.4L18 2z" />
                <path d="M6 18l-4 4" />
                <path d="M4 22l4-4" />
                {/* Crossed Wrench diagonally */}
                <path d="M6.5 4.5l11 11" />
                <circle cx="5" cy="6" r="2" />
                <circle cx="19" cy="18" r="2" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Title & Tagline */}
      <div className="mt-8 text-center space-y-2 z-10">
        <h1 className="font-['Cambria',Georgia,serif] text-4xl font-extrabold tracking-wider bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
          Karigor
        </h1>
        <p className="text-xs uppercase tracking-widest text-sky-300/80 font-medium">
          কারিগর • Trusted Artisans & Craftsmen
        </p>
      </div>
    </div>
  );
}
