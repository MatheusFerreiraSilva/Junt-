import React from 'react';

type PillProps = {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
};

export const Pill: React.FC<PillProps> = ({
  active = false,
  children,
  onClick,
  ariaLabel,
  className = '',
}) => {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded-[999px] px-3.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
        'border',
        active
          ? 'bg-[var(--ink)] text-[var(--surface)] border-[var(--ink)]'
          : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] hover:bg-[var(--surface-sunken)]',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
};

export default Pill;
