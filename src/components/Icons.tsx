import type { CSSProperties } from "react";

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const StethoscopeIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3" />
    <path d="M3 3h3M12 3h3" />
    <path d="M9 12.5V15a5 5 0 0 0 10 0v-1.5" />
    <circle cx="19" cy="11" r="2" />
  </svg>
);

export const SearchIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const BoltIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const PhoneIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
);

export const EyeIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const GlobeIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.2 9h17.6M3.2 15h17.6" />
    <path d="M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9S9.5 5.6 12 3Z" />
  </svg>
);

export const CheckIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const AlertIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17h.01" />
  </svg>
);

export const XIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </svg>
);

export const InfoIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export const QuestionIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3" />
    <path d="M12 17h.01" />
  </svg>
);

export const ChevronIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const WrenchIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M14.7 6.3a4 4 0 0 0 5.1 5.1l-7.4 7.4a2.8 2.8 0 1 1-4-4l7.4-7.4-1.1-1.1Z" />
  </svg>
);

export const ShieldIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 8.1 7 9.5 4.1-1.4 7-5.3 7-9.5V6l-7-3Z" />
  </svg>
);

export const DownloadIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3.5v11M7.5 10 12 14.5 16.5 10" />
    <path d="M4.5 18.5h15" />
  </svg>
);

export const PrintIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M7 9V3.5h10V9" />
    <rect x="3.5" y="9" width="17" height="7" rx="2" />
    <path d="M7 14h10v6.5H7z" />
  </svg>
);

export const RefreshIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M20 11a8 8 0 1 0-.9 4.5" />
    <path d="M20 4.5V11h-6.5" />
  </svg>
);

export const ArrowLeftIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const LinkIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M10 13a4 4 0 0 0 5.7.4l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
    <path d="M14 11a4 4 0 0 0-5.7-.4l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.6-1.6" />
  </svg>
);

export const CodeIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4" />
  </svg>
);

export const SparkIcon = ({ className, style }: IconProps) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M12 8.5 13.3 11l2.5 1-2.5 1-1.3 2.5-1.3-2.5L8.2 12l2.5-1L12 8.5Z" />
  </svg>
);
