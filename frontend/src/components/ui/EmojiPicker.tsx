import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Props {
  open: boolean;
  onToggle: () => void;
  onSelect: (emoji: string) => void;
  placement?: 'top' | 'top-right';
}

const PICKER_W = 352;
const PICKER_H = 435;
const GAP = 8;

export function EmojiPickerButton({ open, onToggle, onSelect, placement = 'top' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // 버튼 위치 기준으로 화면 안에 들어오도록 좌표 계산
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    let left = placement === 'top-right' ? r.right - PICKER_W : r.left;
    // 좌우 뷰포트 보정
    left = Math.max(GAP, Math.min(left, window.innerWidth - PICKER_W - GAP));
    // 버튼 위쪽에 띄우되, 공간 없으면 아래쪽
    let top = r.top - PICKER_H - GAP;
    if (top < GAP) top = Math.min(r.bottom + GAP, window.innerHeight - PICKER_H - GAP);
    setCoords({ top, left });
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(t) &&
        popupRef.current && !popupRef.current.contains(t)
      ) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onToggle]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-primary-50 rounded-lg transition-colors"
        title="이모티콘"
      >
        <Smile size={17} />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[10000] shadow-2xl rounded-xl"
          style={{ top: coords.top, left: coords.left }}
        >
          <Picker
            data={data}
            locale="ko"
            theme="light"
            onEmojiSelect={(e: any) => { onSelect(e.native); onToggle(); }}
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
