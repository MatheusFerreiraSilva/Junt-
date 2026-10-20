import React from 'react';

interface JuntoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'icon' | 'horizontal';
  showText?: boolean;
}

export const JuntoLogo: React.FC<JuntoLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'horizontal',
  showText = true,
}) => {
  // Dimensions based on size preset
  const sizeMap = {
    sm: { width: 32, height: 32, textClass: 'text-base' },
    md: { width: 44, height: 44, textClass: 'text-xl' },
    lg: { width: 64, height: 64, textClass: 'text-3xl' },
    xl: { width: 120, height: 120, textClass: 'text-5xl' },
  };

  const currentSize = typeof size === 'number' 
    ? { width: size, height: size, textClass: 'text-lg' }
    : sizeMap[size];

  // Colors exactly extracted from the official JUNTÔ brand images:
  // Sage Green: #9BB9A3
  // Peach / Coral: #F59E72
  const sageGreen = '#9BB9A3';
  const peachCoral = '#F59E72';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* High-Fidelity Interlocking Infinity Loop (Sage Green + Peach Coral) */}
      <svg
        width={currentSize.width}
        height={currentSize.height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        {/* Soft background glow */}
        <g className="opacity-15 blur-[1px]">
          {/* Sage Green glow */}
          <path
            d="M 50,50 C 35,30 15,30 15,50 C 15,70 35,70 50,50"
            stroke={sageGreen}
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
          />
          {/* Peach Coral glow */}
          <path
            d="M 50,50 C 65,30 85,30 85,50 C 85,70 65,70 50,50"
            stroke={peachCoral}
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Foreground Interlocking Ribbon 1: Peach Coral (wrapping the right loop) */}
        <path
          d="M 50,50 C 65,30 85,30 85,50 C 85,70 65,70 50,50"
          stroke={peachCoral}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Foreground Interlocking Ribbon 2: Sage Green (wrapping the left loop) */}
        <path
          d="M 50,50 C 35,30 15,30 15,50 C 15,70 35,70 50,50"
          stroke={sageGreen}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 3D Overweave: Sage Green ribbon crosses OVER Peach Coral from bottom-left to top-right */}
        <path
          d="M 43,59 L 57,41"
          stroke={sageGreen}
          strokeWidth="11"
          strokeLinecap="round"
        />
      </svg>

      {/* Brand Text "Juntô" with the exact upward curved smile accent over the 'o' */}
      {(variant === 'horizontal' && showText) && (
        <div className="flex flex-col justify-center leading-none">
          <span className={`font-black tracking-tight font-display text-slate-800 dark:text-slate-100 ${currentSize.textClass} flex items-center relative`}>
            Junt
            <span className="relative inline-block">
              o
              {/* Symmetrical upward smiling accent over the 'o' (circumflex redondo ao contrário) */}
              <svg 
                viewBox="0 0 24 12" 
                className="absolute left-1/2 -translate-x-1/2 -top-[6px] w-[15px] h-[7.5px]"
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: peachCoral }}
              >
                <path 
                  d="M2 2C5 8 19 8 22 2" 
                  stroke="currentColor" 
                  strokeWidth="4.5" 
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="text-rose-500 font-extrabold ml-0.5">.</span>
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
            Finanças do Casal
          </span>
        </div>
      )}
    </div>
  );
};
