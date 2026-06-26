export function Crest({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 100 110" aria-label="Kanoongo family crest">
      <path d="M6 8 L94 8 L94 52 Q94 90 50 104 Q6 90 6 52 Z" fill="#6E1E2A" stroke="#C9962E" strokeWidth="3"/>
      <line x1="6" y1="30" x2="94" y2="30" stroke="#C9962E" strokeWidth="1.5" opacity="0.7"/>
      <text x="50" y="74" textAnchor="middle" fontFamily="Georgia, serif" fontSize="48" fontWeight="bold" fill="#F4E3C1">K</text>
      <path d="M50 84 l7 13 l-7 -4 l-7 4 Z" fill="#C9962E"/>
    </svg>
  );
}
