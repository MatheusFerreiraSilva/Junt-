import React, { useEffect, useRef } from 'react';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export const Sheet: React.FC<SheetProps> = ({ open, onClose, children, title }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Sheet'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content: Bottom sheet no mobile (28px top radius), centrado no desktop (28px all around) */}
      <div
        ref={ref}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[var(--surface)] shadow-[var(--shadow-floating)] border-t sm:border border-[var(--border)] transition-transform duration-[220ms] ease-out"
      >
        {/* Sticky Header com alvo fixo de 44px (11) para fechar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)] rounded-t-[28px]">
          <h3 className="text-[17px] font-semibold text-[var(--ink)] m-0">
            {title}
          </h3>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] grid place-items-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="p-5 text-[var(--ink)]">{children}</div>
      </div>
    </div>
  );
};

export default Sheet;
