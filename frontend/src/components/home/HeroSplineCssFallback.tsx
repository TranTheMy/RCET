export function HeroSplineCssFallback({ heroRevealed }: { heroRevealed: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[32px]" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-[min(100%,520px)] w-[min(100%,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-400/20 via-blue-600/15 to-indigo-900/25 blur-3xl motion-reduce:opacity-90" />
      <div className="absolute -right-[15%] top-[15%] h-[45%] w-[55%] rounded-full bg-cyan-500/15 blur-[80px]" />
      <div className="absolute -left-[10%] bottom-[5%] h-[40%] w-[50%] rounded-full bg-indigo-600/10 blur-[90px]" />
      <div
        className={`absolute inset-0 opacity-[0.12] motion-reduce:animate-none ${heroRevealed ? 'animate-pulse' : ''}`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgba(34,211,238,0.35) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}
