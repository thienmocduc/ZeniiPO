/**
 * Cosmic energy background — subtle / nhẹ nhàng như không gian vũ trụ.
 *
 * Chakra 6 (Ajna · indigo-violet) + Chakra 7 (Sahasrara · violet→white→gold)
 * Layers (bottom → top):
 *   1. Base: radial ellipse indigo-900 → #05070C
 *   2. Aurora sheen A: chakra-6 indigo radial, slowly drifting
 *   3. Aurora sheen B: chakra-7 violet radial, slowly drifting (counter-phase)
 *   4. Crown glow: optional soft gold radial top-center
 *   5. Starfield: existing drift animation
 */
export function CosmosBg({
  crown = true,
}: {
  /** Show optional soft gold crown glow top-center (for header hero area). */
  crown?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="cosmos fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      {/* Aurora A — Chakra 6 indigo */}
      <div
        className="absolute inset-0 opacity-[0.35] animate-aurora"
        style={{
          willChange: 'transform',
          background:
            'radial-gradient(60% 45% at 20% 30%, rgba(99,102,241,0.28) 0%, rgba(49,46,129,0.12) 40%, transparent 70%)',
        }}
      />
      {/* Aurora B — Chakra 7 violet, counter-phase */}
      <div
        className="absolute inset-0 opacity-[0.30] animate-aurora"
        style={{
          willChange: 'transform',
          animationDelay: '-10s',
          background:
            'radial-gradient(55% 50% at 80% 70%, rgba(168,85,247,0.26) 0%, rgba(124,58,237,0.10) 42%, transparent 72%)',
        }}
      />
      {/* Optional soft crown glow top-center — gold-crown Sahasrara */}
      {crown && (
        <div
          className="absolute inset-x-0 top-0 h-[55vh] opacity-[0.22]"
          style={{
            background:
              'radial-gradient(50% 80% at 50% -10%, rgba(228,193,110,0.35) 0%, rgba(228,193,110,0.10) 35%, transparent 65%)',
          }}
        />
      )}
    </div>
  );
}
