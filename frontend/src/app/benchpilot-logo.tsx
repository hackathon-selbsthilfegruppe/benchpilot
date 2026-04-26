type Props = {
  className?: string;
  testId?: string;
  ariaLabel?: string;
};

export function BenchpilotLogo({ className, testId, ariaLabel = "BenchPilot" }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 700 150"
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
      <g transform="translate(10, 0)">
        <path
          d="M 15,75 L 110,32 L 85,115 L 50,78 Z"
          fill="none"
          stroke="url(#benchpilot-plane-gradient)"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M 50,78 L 110,32"
          fill="none"
          stroke="url(#benchpilot-plane-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="75" r="9.5" fill="#0ea5e9" />
        <circle cx="50" cy="78" r="9.5" fill="#3b82f6" />
        <circle cx="85" cy="115" r="9.5" fill="#8b5cf6" />
        <circle cx="110" cy="32" r="9.5" fill="#6366f1" />
      </g>
      <text
        x="145"
        y="105"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="110"
        letterSpacing="-2.5"
      >
        <tspan fontWeight="800" fill="currentColor">
          bench
        </tspan>
        <tspan fontWeight="300" fill="#818cf8">
          pilot
        </tspan>
      </text>
    </svg>
  );
}
