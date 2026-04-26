type Props = {
  className?: string;
  testId?: string;
  ariaLabel?: string;
};

export function BenchpilotLogo({ className, testId, ariaLabel = "BenchPilot — protocol generation engine" }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 620 220"
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
    >
      <defs>
        <linearGradient id="benchpilot-plane-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* Mark — scaled 1.7x and centred vertically against the wordmark. */}
      <g transform="translate(10, 18) scale(1.7)">
        <path
          d="M 15,75 L 110,25 L 85,120 L 55,80 Z"
          fill="none"
          stroke="url(#benchpilot-plane-gradient)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M 55,80 L 110,25"
          fill="none"
          stroke="url(#benchpilot-plane-gradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="75" r="8" fill="#0ea5e9" />
        <circle cx="55" cy="80" r="8" fill="#3b82f6" />
        <circle cx="85" cy="120" r="8" fill="#8b5cf6" />
        <circle cx="110" cy="25" r="9" fill="#6366f1" />
      </g>
      {/* Wordmark — bumped to fs 88 to match the bigger mark. */}
      <text
        x="240"
        y="138"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="88"
        letterSpacing="-2.5"
      >
        <tspan fontWeight="800" fill="currentColor">
          bench
        </tspan>
        <tspan fontWeight="300" fill="#818cf8">
          pilot
        </tspan>
      </text>
      <text
        x="245"
        y="172"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="18"
        fontWeight="600"
        fill="currentColor"
        fillOpacity="0.55"
        letterSpacing="3.5"
      >
        PROTOCOL GENERATION ENGINE
      </text>
    </svg>
  );
}
