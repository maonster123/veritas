export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Deep gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1121] via-[#131b33] to-[#0f172a]" />

      {/* Floating orbs */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl animate-float-medium" />
        <div className="absolute top-2/3 left-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-float-fast" />
        <div className="absolute top-1/5 right-1/3 w-48 h-48 bg-violet-500/15 rounded-full blur-3xl animate-float-slower" />
      </div>

      {/* Geometric grid lines */}
      <div className="absolute inset-0 opacity-[0.04]">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-indigo-600/5 via-cyan-500/5 to-transparent rounded-full blur-2xl" />
    </div>
  );
}
