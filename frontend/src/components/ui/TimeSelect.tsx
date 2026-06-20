import { useState, useEffect } from 'react';
import { Pencil, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  value: string;                 // "HH:mm" 형식 (빈 문자열 허용)
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  step?: number;                 // 드롭다운 분 단위 간격 (기본 30분)
}

const CUSTOM = '__custom__';

// 00:00 ~ 23:30 시간 옵션 생성
function buildOptions(step: number) {
  const opts: { value: string; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const value = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    opts.push({ value, label: `${ampm} ${h12}:${String(min).padStart(2, '0')}` });
  }
  return opts;
}

// 자유 입력값을 "HH:mm"으로 정규화 ("915"→"09:15", "9:5"→"09:05")
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

export function TimeSelect({ value, onChange, className, placeholder = '시간 선택', step = 30 }: Props) {
  const options = buildOptions(step);
  const isPreset = !value || options.some((o) => o.value === value);
  // 값이 30분 단위가 아니면(예: 09:15) 처음부터 직접 입력 모드
  const [custom, setCustom] = useState(!isPreset);
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
    if (value && !options.some((o) => o.value === value)) setCustom(true);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = 'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  // 직접 입력 모드: 시:분 자유 수정 + 목록으로 돌아가기
  if (custom) {
    return (
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          placeholder="예) 09:15"
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { const n = normalize(text); setText(n); onChange(n); }}
          className={cn(base, 'pr-9', className)}
        />
        <button
          type="button"
          title="목록에서 선택"
          onClick={() => { setCustom(false); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <ChevronDown size={15} />
        </button>
      </div>
    );
  }

  // 드롭다운 모드: 30분 단위 선택 + "직접 입력"
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) { setCustom(true); return; }
          onChange(e.target.value);
        }}
        className={cn(base, 'pr-9 appearance-none', !value && 'text-gray-400', className)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-gray-900">{o.label}</option>
        ))}
        <option value={CUSTOM} className="text-primary-600">직접 입력…</option>
      </select>
      <Pencil
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
      />
    </div>
  );
}
