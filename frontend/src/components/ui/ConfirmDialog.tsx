import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  /** 안내 전용 모드 (취소 버튼 숨김, 확인 버튼만 표시) */
  infoOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles = {
  primary: {
    iconBg: 'bg-primary-600',
    confirmBtn: 'bg-primary-600 hover:bg-primary-700',
  },
  danger: {
    iconBg: 'bg-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  tone = 'primary',
  loading = false,
  infoOnly = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancelRef.current(); }
      if (e.key === 'Enter')  { e.preventDefault(); onConfirmRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const s = toneStyles[tone];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm', s.iconBg)}>
              <AlertTriangle size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        {message && (
          <div className="px-5 py-5 text-sm text-gray-600 leading-relaxed">
            {message}
          </div>
        )}

        {/* 푸터 */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          {!infoOnly && (
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 h-11 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50',
              s.confirmBtn,
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
