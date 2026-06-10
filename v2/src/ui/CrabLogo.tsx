// The mascot, simplified for header duty. Inherits the theme accent.

export function CrabLogo({ size = 30 }: { size?: number }) {
  return (
    <svg className="crab-logo" width={size} height={size} viewBox="0 0 100 100" aria-label="Spicerack crab">
      <g stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" fill="none">
        <line x1="30" y1="74" x2="18" y2="84" />
        <line x1="34" y1="82" x2="24" y2="92" />
        <line x1="70" y1="74" x2="82" y2="84" />
        <line x1="66" y1="82" x2="76" y2="92" />
        <path d="M 32 58 Q 22 52 19 43" />
        <path d="M 68 58 Q 78 52 81 43" />
      </g>
      <path d="M 22 24 A 14 14 0 1 0 29 37 L 17 32 Z" fill="var(--accent)" />
      <path d="M 78 24 A 14 14 0 1 1 71 37 L 83 32 Z" fill="var(--accent)" />
      <g stroke="var(--accent)" strokeWidth="6" strokeLinecap="round">
        <line x1="42" y1="48" x2="40" y2="36" />
        <line x1="58" y1="48" x2="60" y2="36" />
      </g>
      <ellipse cx="50" cy="66" rx="26" ry="20" fill="var(--accent)" />
      <circle cx="40" cy="33" r="7.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="3.5" />
      <circle cx="60" cy="33" r="7.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="3.5" />
      <circle cx="41.5" cy="34.5" r="3" fill="var(--accent)" />
      <circle cx="58.5" cy="34.5" r="3" fill="var(--accent)" />
      <path d="M 42 66 L 47 71 L 52 66 L 57 71" fill="none" stroke="var(--accent-contrast)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
