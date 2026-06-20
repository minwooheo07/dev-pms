import { useId, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  value: string;                 // "HH:mm" 형식 (빈 문자열 허용)
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  step?: number;                 // 추천 목록 분 단위 간격 (기본 30분)
}

// 00:00 ~ 23:30 추천 시간 옵션
function buildOptions(step: number) {
  const opts: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    opts.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return opts;
}

// 자유 입력값을 "HH:mm"으로 정규화 ("1522"→"15:22", "9:5"→"09:05")
function normalize(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  let h: number, m: number;
  if (s.includes(':')) {
    const [hp, mp] = s.split(':');
    h = parseInt(hp, 10); m = parseInt(mp || '0', 10);
  } else {
    const d = s.replace(/\D/g, '');
    if (d.length <= 2) { h = parseInt(d, 10); m = 0; }
    else { h = parseInt(d.slice(0, d.length - 2), 10); m = parseInt(d.slice(-2), 10); }
  }
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return raw;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TimeSelect({ value, onChange, className, placeholder = '예) 15:22', step = 30 }: Props) {
  const listId = useId();
  const options = buildOptions(step);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  return (
    <>
      <input
        type="text"
        list={listId}
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          // 목록에서 선택(완성형 HH:mm)이면 즉시 반영
          if (/^\d{1,2}:\d{2}$/.test(e.target.value)) onChange(normalize(e.target.value));
        }}
        onBlur={() => { const n = normalize(text); setText(n); onChange(n); }}
        className={cn(
          'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500',
          className,
        )}
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}
