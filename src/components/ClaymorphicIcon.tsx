import React from 'react';

export type ClayIconType =
  | 'housing'
  | 'food'
  | 'transport'
  | 'leisure'
  | 'protection'
  | 'career'
  | 'investments'
  | 'travel'
  | 'tv'
  | 'furniture'
  | 'car'
  | 'wedding'
  | 'baby'
  | 'heart'
  | 'sparkle'
  | 'shield';

interface ClaymorphicIconProps {
  type: ClayIconType;
  size?: number;
  className?: string;
  tone?: 'lavender' | 'ochre' | 'skyblue' | 'pink' | 'sage' | 'charcoal';
}

const TONE_COLORS = {
  lavender: {
    bg: '#D8C7FF',
    glow: 'rgba(216, 199, 255, 0.45)',
    border: '#C3ADFF',
    highlight: '#FFFFFF',
    inner: '#7042EB',
  },
  ochre: {
    bg: '#FFC875',
    glow: 'rgba(255, 200, 117, 0.45)',
    border: '#F7B44D',
    highlight: '#FFFFFF',
    inner: '#8A5200',
  },
  skyblue: {
    bg: '#A6D8FF',
    glow: 'rgba(166, 216, 255, 0.45)',
    border: '#85C7FF',
    highlight: '#FFFFFF',
    inner: '#0B64B8',
  },
  pink: {
    bg: '#FFC2E2',
    glow: 'rgba(255, 194, 226, 0.45)',
    border: '#FFA3D3',
    highlight: '#FFFFFF',
    inner: '#B01869',
  },
  sage: {
    bg: '#B8E0B0',
    glow: 'rgba(184, 224, 176, 0.45)',
    border: '#9FD495',
    highlight: '#FFFFFF',
    inner: '#2B6E20',
  },
  charcoal: {
    bg: '#181B22',
    glow: 'rgba(24, 27, 34, 0.35)',
    border: '#2A2F3D',
    highlight: 'rgba(255,255,255,0.2)',
    inner: '#FAF7F2',
  },
};

export const ClaymorphicIcon: React.FC<ClaymorphicIconProps> = ({
  type,
  size = 48,
  className = '',
  tone = 'sage',
}) => {
  const colors = TONE_COLORS[tone] || TONE_COLORS.sage;
  const radius = size * 0.32; // Squircle rounded corner

  const renderPath = () => {
    switch (type) {
      case 'housing':
        return (
          // Roof + House Body
          <g fill={colors.inner}>
            <path
              d="M14 26 L24 16 L34 26 L31 26 L31 32 C31 33.1 30.1 34 29 34 L19 34 C17.9 34 17 33.1 17 32 L17 26 Z"
              strokeWidth="0"
            />
            <rect x="22" y="27" width="4" height="7" rx="1.5" fill="#FAF7F2" opacity="0.8" />
          </g>
        );
      case 'food':
        return (
          // Fork & Spoon / Plate
          <g fill={colors.inner}>
            <circle cx="24" cy="25" r="9" opacity="0.25" />
            <circle cx="24" cy="25" r="6" />
            <rect x="23" y="20" width="2" height="10" rx="1" fill="#FAF7F2" opacity="0.75" />
          </g>
        );
      case 'transport':
      case 'car':
        return (
          // Sleek car outline
          <g fill={colors.inner}>
            <path d="M16 26 L19 20 C19.5 19 20.5 18 22 18 L26 18 C27.5 18 28.5 19 29 20 L32 26 L33 27 C33.5 27.5 33.5 28.5 33 29 L32 30 L16 30 L15 29 C14.5 28.5 14.5 27.5 15 27 Z" />
            <circle cx="19" cy="30" r="2.5" fill="#111318" />
            <circle cx="29" cy="30" r="2.5" fill="#111318" />
          </g>
        );
      case 'leisure':
        return (
          // Celebration glasses / Confetti
          <g fill={colors.inner}>
            <path d="M19 18 L29 18 L26 25 C25.5 26.5 24 27.5 22.5 27.5 L22.5 31 L26 31 C26.5 31 27 31.5 27 32 C27 32.5 26.5 33 26 33 L21 33 C20.5 33 20 32.5 20 32 C20 31.5 20.5 31 21 31 L24.5 31 L24.5 27.5 C23 27.5 21.5 26.5 21 25 Z" />
            <circle cx="28" cy="18" r="1.5" opacity="0.6" />
            <circle cx="18" cy="20" r="1.5" opacity="0.6" />
          </g>
        );
      case 'protection':
      case 'shield':
        return (
          // Rubbery Shield with star
          <g fill={colors.inner}>
            <path d="M24 16 L32 19 C32 25 28 30 24 33 C20 30 16 25 16 19 Z" />
            <circle cx="24" cy="24" r="3" fill="#FAF7F2" opacity="0.9" />
          </g>
        );
      case 'career':
        return (
          // Briefcase
          <g fill={colors.inner}>
            <rect x="16" y="21" width="16" height="12" rx="3" />
            <path d="M21 21 L21 18 C21 17.5 21.5 17 22 17 L26 17 C26.5 17 27 17.5 27 18 L27 21" stroke={colors.inner} strokeWidth="2" fill="none" />
            <rect x="22.5" y="23" width="3" height="3" rx="1" fill="#FAF7F2" />
          </g>
        );
      case 'investments':
        return (
          // Ascending rocket / growth
          <g fill={colors.inner}>
            <path d="M21 28 L27 22 L25 21 L31 20 L30 26 L28 24 L22 30 Z" />
            <circle cx="18" cy="30" r="2" />
          </g>
        );
      case 'travel':
        return (
          // Airplane
          <g fill={colors.inner}>
            <path d="M24 16 L26 21 L32 23 L32 25 L26 24 L25 29 L27 31 L27 32 L24 31 L21 32 L21 31 L23 29 L22 24 L16 25 L16 23 L22 21 Z" />
          </g>
        );
      case 'tv':
        return (
          // Modern Smart TV
          <g fill={colors.inner}>
            <rect x="15" y="18" width="18" height="12" rx="2" />
            <rect x="17" y="20" width="14" height="8" rx="1" fill="#FAF7F2" opacity="0.75" />
            <rect x="22" y="30" width="4" height="2" />
            <rect x="20" y="32" width="8" height="1.5" rx="0.75" />
          </g>
        );
      case 'furniture':
        return (
          // Cozy Armchair
          <g fill={colors.inner}>
            <path d="M18 20 C18 19 19 18 20 18 L28 18 C29 18 30 19 30 20 L30 27 L18 27 Z" />
            <rect x="15" y="23" width="4" height="7" rx="2" />
            <rect x="29" y="23" width="4" height="7" rx="2" />
            <rect x="17" y="26" width="14" height="4" rx="2" fill="#FAF7F2" opacity="0.5" />
            <rect x="18" y="30" width="2" height="3" rx="1" />
            <rect x="28" y="30" width="2" height="3" rx="1" />
          </g>
        );
      case 'heart':
      case 'wedding':
        return (
          // Sweet couple heart
          <g fill={colors.inner}>
            <path d="M24 32 C23.5 32 16 26.5 16 21.5 C16 18.5 18.5 16 21.5 16 C23 16 24.5 17 25 18 C25.5 17 27 16 28.5 16 C31.5 16 34 18.5 34 21.5 C34 26.5 24.5 32 24 32 Z" />
          </g>
        );
      default:
        return (
          // Sparkle
          <g fill={colors.inner}>
            <path d="M24 16 L25.5 22.5 L32 24 L25.5 25.5 L24 32 L22.5 25.5 L16 24 L22.5 22.5 Z" />
          </g>
        );
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-center relative select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className="overflow-visible"
      >
        <defs>
          {/* Soft Clay Drop Shadow Filter */}
          <filter id={`clay-shadow-${type}-${tone}`} x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={colors.glow} />
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.06)" />
          </filter>

          {/* Clay Tactile Gradient */}
          <linearGradient id={`clay-grad-${tone}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="40%" stopColor={colors.bg} />
            <stop offset="100%" stopColor={colors.border} />
          </linearGradient>
        </defs>

        {/* Squircle Pill Base with Clay Drop Shadow */}
        <rect
          x="4"
          y="4"
          width="40"
          height="40"
          rx={radius}
          fill={`url(#clay-grad-${tone})`}
          filter={`url(#clay-shadow-${type}-${tone})`}
          stroke={colors.border}
          strokeWidth="1.25"
        />

        {/* Soft Embossed Highlight Lip on Top */}
        <path
          d={`M 12 7 Q 24 5 36 7`}
          stroke={colors.highlight}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.75"
          fill="none"
        />

        {/* Main Icon Path Centered */}
        {renderPath()}
      </svg>
    </div>
  );
};
