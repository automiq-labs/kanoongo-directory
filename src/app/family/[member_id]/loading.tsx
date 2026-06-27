export default function FamilyCardLoading() {
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
        {/* Profile card skeleton — avatar + name */}
        <div className="rounded-[var(--r-lg)] border border-[var(--border-card)] bg-[var(--raised)] p-5">
          <div className="flex items-center gap-4">
            {/* Large avatar */}
            <div
              className="skel h-14 w-14 shrink-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                backgroundSize: "800px 100%",
                animation: "shimmer 1.6s ease-in-out infinite",
              }}
            />
            <div className="min-w-0 flex-1 space-y-2.5">
              {/* Name line */}
              <div
                className="skel h-[16px] w-[65%] rounded-full"
                style={{
                  background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                  backgroundSize: "800px 100%",
                  animation: "shimmer 1.6s ease-in-out 0.05s infinite",
                }}
              />
              {/* Gotra line */}
              <div
                className="skel h-[12px] w-[40%] rounded-full"
                style={{
                  background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                  backgroundSize: "800px 100%",
                  animation: "shimmer 1.6s ease-in-out 0.1s infinite",
                }}
              />
            </div>
          </div>
        </div>

        {/* Section skeletons — personal, contact, spouse, children */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mt-6">
            {/* Section title */}
            <div className="mb-3 flex items-center gap-2">
              <div
                className="skel h-[14px] rounded-full"
                style={{
                  width: `${80 + i * 15}px`,
                  background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                  backgroundSize: "800px 100%",
                  animation: `shimmer 1.6s ease-in-out ${0.15 + i * 0.08}s infinite`,
                }}
              />
            </div>
            <div className="h-px bg-[var(--gold)]/25 mb-3" />

            {/* Content block */}
            <div className="rounded-[var(--r-lg)] border border-[var(--border-card)] bg-[var(--raised)] p-4 space-y-3">
              {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-3 border-b border-[var(--border-warm)] pb-2.5 last:border-0 last:pb-0">
                  <div
                    className="skel h-[11px] rounded-full"
                    style={{
                      width: `${60 + j * 20}px`,
                      background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                      backgroundSize: "800px 100%",
                      animation: `shimmer 1.6s ease-in-out ${0.2 + i * 0.08 + j * 0.05}s infinite`,
                    }}
                  />
                  <div
                    className="skel h-[11px] rounded-full"
                    style={{
                      width: `${80 + j * 15}px`,
                      background: "linear-gradient(90deg, #ECE3D2 0%, #F5EDE0 40%, #ECE3D2 80%)",
                      backgroundSize: "800px 100%",
                      animation: `shimmer 1.6s ease-in-out ${0.25 + i * 0.08 + j * 0.05}s infinite`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
