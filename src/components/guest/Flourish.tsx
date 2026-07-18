/** Gold line—diamond—line divider used across the guest-facing pages. */
export function Flourish({ className, delay }: { className?: string; delay?: string }) {
  return (
    <svg
      width="132"
      height="10"
      viewBox="0 0 132 10"
      className={className}
      style={delay ? { animationDelay: delay } : undefined}
      aria-hidden
    >
      <line x1="0" y1="5" x2="54" y2="5" stroke="var(--gold-soft)" strokeWidth="1" />
      <rect
        x="62"
        y="1"
        width="8"
        height="8"
        transform="rotate(45 66 5)"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1"
      />
      <line x1="78" y1="5" x2="132" y2="5" stroke="var(--gold-soft)" strokeWidth="1" />
    </svg>
  )
}
