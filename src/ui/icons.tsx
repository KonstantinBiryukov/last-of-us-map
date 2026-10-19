/**
 * icons.tsx — the app's icon set: small inline SVGs drawn with simple strokes.
 *
 * Inline SVG (instead of an icon font or image files) means: no extra download,
 * crisp at any size, and the colour follows the surrounding text (`currentColor`).
 * Icons are decorative (`aria-hidden`): every button that uses one also has a
 * text label for screen readers.
 */
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </Icon>
);
export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const SkipBackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 5v14L8 12z" fill="currentColor" stroke="none" />
    <path d="M6 5v14" />
  </Icon>
);
export const SkipForwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 5v14l10-7z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </Icon>
);
export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
);
export const ReplayIcon = RestartIcon;
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const VolumeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" stroke="none" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 6a8.5 8.5 0 0 1 0 12" />
  </Icon>
);
export const MuteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" stroke="none" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </Icon>
);
export const MusicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
);
export const FollowIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="7.5" />
  </Icon>
);
export const OverviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);
export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
);
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const WalkIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="13" cy="4" r="1.8" />
    <path d="M10 21l2.5-6.5L15 17v4M12.5 14.5l.8-5.5 3.2 3 2.5 1M13.3 9L9 10.5 7.5 14" />
  </Icon>
);
export const HorseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20v-5c0-2 1-3.5 3-4l5-1 2-4 3 1 2.5 3-1.5 1.5-2-.5-1 2.5V20M8 15v5M14 15v5" />
  </Icon>
);
export const TruckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 16V7h11v9M13 10h4l3 3v3h-7" />
    <circle cx="6.5" cy="17.5" r="1.8" />
    <circle cx="16.5" cy="17.5" r="1.8" />
  </Icon>
);
/** A curved arrow: a "jump" over a stretch with no detailed path. */
export const JumpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 17c3-9 13-9 17-1" strokeDasharray="2.5 2.5" />
    <path d="M16 12.5l4 3.5-4.5 2" />
  </Icon>
);
/** A little house: back to the main menu. */
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 9.5V20h12V9.5" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 19V5" />
  </Icon>
);
