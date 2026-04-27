import { Outlet } from 'react-router-dom';

/**
 * AuthLayout — split editorial hero on the left, form on the right.
 * The left panel is the SecureEdge signature: deep ink, mesh motif, editorial headline.
 * On narrow viewports the hero collapses to a compact top strip.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen w-full bg-surface-2 lg:grid lg:grid-cols-[1fr_520px]">
      {/* Left — hero (hidden below lg; collapsed to a slim header above) */}
      <aside className="relative hidden overflow-hidden bg-ink-900 text-ink-0 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <MeshBackdrop />

        <div className="relative z-10 flex items-center gap-3">
          <LogoMark invert />
          <span className="font-display text-2xl leading-none tracking-[-0.02em]">secureedge</span>
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-6xl leading-[1.02] tracking-[-0.03em] text-balance">
            Access, <em className="not-italic text-signal-300 font-display italic">granted</em>.
            <br />
            One identity, every app.
          </h1>
          <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-ink-0/70">
            Zero-trust access for the apps your team relies on — gated by who you are, what
            you're on, and where you are.
          </p>
        </div>

        <div className="relative z-10 font-mono text-[11px] text-ink-0/40">
          v2.4 · us-east-1 · 99.99% ↑ 30d
        </div>
      </aside>

      {/* Mobile strip */}
      <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-900 px-6 py-4 text-ink-0 lg:hidden">
        <LogoMark invert />
        <span className="font-display text-xl leading-none tracking-[-0.02em]">secureedge</span>
      </div>

      {/* Right — form */}
      <main className="flex items-center justify-center px-6 py-12 lg:px-14">
        <div className="w-full max-w-[380px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function LogoMark({ invert = false }: { invert?: boolean }) {
  const base = invert ? '#FDFCF8' : '#0E0D0A';
  const accent = invert ? '#7FCD7A' : '#3CB13A';
  return (
    <svg width="28" height="28" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="6" r="3.4" fill={base} />
      <circle cx="6" cy="22" r="3.4" fill={base} />
      <circle cx="28" cy="22" r="3.4" fill={accent} />
      <path d="M17 6 L6 22" stroke={base} strokeWidth="1.6" />
      <path d="M17 6 L28 22" stroke={base} strokeWidth="1.6" />
      <path d="M6 22 L28 22" stroke={base} strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}

function MeshBackdrop() {
  return (
    <svg
      viewBox="0 0 520 700"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-90"
      aria-hidden
    >
      <defs>
        <radialGradient id="auth-mh" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#3CB13A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#3CB13A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="260" cy="400" r="280" fill="url(#auth-mh)" />
      <g stroke="#FDFCF8" strokeWidth="0.5" opacity="0.14">
        <path d="M60 140 L260 380 L460 200" />
        <path d="M160 60 L360 300 L260 540" />
        <path d="M60 460 L260 380 L460 460" strokeDasharray="4 4" />
      </g>
      <g>
        <circle cx="260" cy="380" r="10" fill="#3CB13A" stroke="#FDFCF8" strokeWidth="2" />
        <circle cx="60" cy="140" r="5" fill="#FDFCF8" />
        <circle cx="460" cy="200" r="5" fill="#FDFCF8" />
        <circle cx="360" cy="300" r="5" fill="#FDFCF8" />
        <circle cx="160" cy="60" r="5" fill="#FDFCF8" />
        <circle cx="260" cy="540" r="5" fill="#E8A838" />
        <circle cx="60" cy="460" r="5" fill="#FDFCF8" />
        <circle cx="460" cy="460" r="5" fill="#FDFCF8" />
      </g>
    </svg>
  );
}
