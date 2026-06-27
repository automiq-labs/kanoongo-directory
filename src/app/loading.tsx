export default function DirectoryLoading() {
  return (
    <div className="min-h-screen bg-[var(--cream)] pb-20">
      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0;  }
        }
        @media (prefers-reduced-motion: reduce) {
          .skel { animation: none !important; }
        }
      `}</style>

      {/* Header placeholder */}
      <div
        className="sticky top-0 z-10 h-[52px] border-b border-[var(--hairline)]"
        style={{
          background: "linear-gradient(180deg, #33121a, var(--ink))",
          paddingTop: "max(0px, env(safe-area-inset-top, 0px))",
        }}
      />

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* Search skeleton */}
        <div
          className="skel mb-4 h-[48px] rounded-[var(--r)] border border-[#ECE0C8]"
          style={{
            background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
            backgroundSize: "800px 100%",
            animation: "shimmer 1.6s ease-in-out infinite",
          }}
        />

        {/* Filter row skeleton */}
        <div className="mb-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skel h-[44px] flex-1 rounded-[var(--r-sm)]"
              style={{
                background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                backgroundSize: "800px 100%",
                animation: `shimmer 1.6s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Count skeleton */}
        <div
          className="skel mb-4 h-[16px] w-[120px] rounded-full"
          style={{
            background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
            backgroundSize: "800px 100%",
            animation: "shimmer 1.6s ease-in-out infinite",
          }}
        />

        {/* Member card skeletons with thread */}
        <div className="relative">
          {/* Thread hairline */}
          <div
            className="absolute left-[8px] sm:left-[14px] top-0 bottom-0 w-[2px] opacity-40"
            style={{ background: "linear-gradient(to bottom, transparent, var(--gold) 6%, var(--gold) 94%, transparent)" }}
          />

          <div className="space-y-2 sm:space-y-[10px]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="relative pl-[18px] sm:pl-[24px]">
                {/* Diamond node */}
                <div className="absolute left-[4px] sm:left-[10px] top-1/2 z-[1] h-[8px] w-[8px] sm:h-[9px] sm:w-[9px] -translate-y-1/2 rotate-45 border-[1.5px] border-[var(--gold)]/40 bg-[var(--paper)]" />
                {/* Tick */}
                <div className="absolute left-[10px] sm:left-[14px] top-1/2 h-px w-[8px] sm:w-[10px] -translate-y-1/2 bg-[var(--gold)] opacity-30" />

                {/* Card skeleton */}
                <div className="flex w-full items-center gap-2.5 sm:gap-3 rounded-[var(--r-lg)] border border-[#EFE4CD] bg-[var(--raised)] p-3.5 sm:px-[15px] sm:py-[14px]">
                  {/* Avatar circle */}
                  <div
                    className="skel h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                      backgroundSize: "800px 100%",
                      animation: `shimmer 1.6s ease-in-out ${i * 0.08}s infinite`,
                    }}
                  />
                  {/* Text lines */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      className="skel h-[14px] rounded-full"
                      style={{
                        width: `${60 + (i % 3) * 12}%`,
                        background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                        backgroundSize: "800px 100%",
                        animation: `shimmer 1.6s ease-in-out ${i * 0.08 + 0.05}s infinite`,
                      }}
                    />
                    <div
                      className="skel h-[10px] w-[45%] rounded-full"
                      style={{
                        background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                        backgroundSize: "800px 100%",
                        animation: `shimmer 1.6s ease-in-out ${i * 0.08 + 0.1}s infinite`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
