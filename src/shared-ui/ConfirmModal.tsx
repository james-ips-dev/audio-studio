import React, { useEffect } from 'react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  alertOnly?: boolean; // When true, hides the Cancel button (for error/toast alerts)
  accentColor?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  alertOnly = false,
  accentColor = '#38BDF8',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onCancel) onCancel();
        else onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const badgeColors = {
    danger: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
    warning: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    info: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={() => (onCancel ? onCancel() : onConfirm())}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/15 bg-[#12151E] p-5 shadow-2xl text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className={`px-2 py-0.5 text-[10px] font-studio-mono uppercase tracking-wider font-bold rounded border ${badgeColors}`}
          >
            {variant.toUpperCase()}
          </span>
          <h3 className="text-sm font-semibold tracking-wide text-white">
            {title}
          </h3>
        </div>

        <p className="text-xs leading-relaxed text-gray-300 mb-5 font-studio-mono bg-black/40 p-3 rounded-lg border border-white/5">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2.5">
          {!alertOnly && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              backgroundColor:
                variant === 'danger'
                  ? '#E11D48'
                  : variant === 'warning'
                    ? '#D97706'
                    : accentColor,
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-black hover:brightness-110 transition-all cursor-pointer shadow"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
