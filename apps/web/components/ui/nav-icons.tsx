type IconProps = { className?: string };

const base = "18";
const iconProps = {
  viewBox: `0 0 ${base} ${base}`,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="2" y="2" width="6" height="6" rx="1.2" />
      <rect x="10" y="2" width="6" height="6" rx="1.2" />
      <rect x="2" y="10" width="6" height="6" rx="1.2" />
      <rect x="10" y="10" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export function LeadsIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M9 16.5S15 11.2 15 7a6 6 0 1 0-12 0c0 4.2 6 9.5 6 9.5Z" />
      <circle cx="9" cy="7" r="2" />
    </svg>
  );
}

export function CampaignsIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M2 8.2v3.6a1 1 0 0 0 1 1h1.3l1.2 4.3a1 1 0 0 0 1 .7h.6a1 1 0 0 0 .95-1.3L6.3 12.8H8l7 3.3V3.9L8 7.2H3a1 1 0 0 0-1 1Z" />
      <path d="M14.8 7a3.3 3.3 0 0 1 0 5.9" />
    </svg>
  );
}

export function OutreachIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M2.5 4.5h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 3v-3H2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <circle cx="6" cy="9" r=".7" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r=".7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="9" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AnalyticsIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M3 15.5V10" />
      <path d="M9 15.5V5" />
      <path d="M15 15.5V8.5" />
      <path d="M2 15.5h14" />
    </svg>
  );
}

export function ServicesIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="2.5" y="6" width="13" height="9" rx="1.2" />
      <path d="M6.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M2.5 10h13" />
    </svg>
  );
}

export function TeamIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="12.5" cy="7" r="2.5" />
      <path d="M2 16c.3-2.8 2-4.5 4.5-4.5S11 13.2 11 16" />
      <path d="M9 16c.3-2.5 1.8-4 3.5-4s3.3 1.5 3.5 4" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M3 5h7M13 5h2" />
      <circle cx="10" cy="5" r="1.6" />
      <path d="M3 9h2M8 9h7" />
      <circle cx="5.5" cy="9" r="1.6" />
      <path d="M3 13h7M13 13h2" />
      <circle cx="10" cy="13" r="1.6" />
    </svg>
  );
}
