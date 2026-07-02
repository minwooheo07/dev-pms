import { GridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import type { FormField } from '../../api/forms';
import { cn } from '../../lib/utils';

// ── 그리드 공통 설정 (빌더와 공유) ─────────────────────────────
export const GRID_COLS = 12;
export const GRID_ROW_H = 40;
export const GRID_MARGIN: readonly [number, number] = [8, 8];

// 타입별 기본 높이(그리드 행 단위)
export function defaultH(f: FormField): number {
  switch (f.type) {
    case 'title': return 1;
    case 'body': return 2;
    case 'multitext': return 4;
    case 'singleSelect':
    case 'checkbox': {
      const n = f.options?.length ?? 2;
      return Math.max(2, Math.ceil(n / 2) + 1);
    }
    default: return 2;
  }
}

// layout이 없는(구버전) 필드에 기본 그리드 레이아웃 부여 — 기존 width% 값을 12컬럼으로 환산
export function ensureLayouts(fields: FormField[]): FormField[] {
  let y = 0;
  return fields.map((f) => {
    if (f.layout) { y = Math.max(y, f.layout.y + f.layout.h); return f; }
    const w = Math.max(2, Math.round(((f.width ?? 100) * GRID_COLS) / 100));
    const h = defaultH(f);
    const laid = { ...f, layout: { x: 0, y, w, h } };
    y += h;
    return laid;
  });
}

// ── 단일 필드 위젯 (빌더 캔버스와 실제 작성 화면 공용) ──────────
export function FieldWidget({ field: f, value, onChange, readOnly, error }: {
  field: FormField;
  value: any;
  onChange?: (v: any) => void;
  readOnly?: boolean;
  error?: string;
}) {
  const base = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400';
  const fs: React.CSSProperties = { fontSize: f.fontSize ?? 14 };

  if (f.type === 'title') {
    return (
      <h3 className="font-bold text-gray-800 w-full h-full flex items-center" style={{ fontSize: f.fontSize ?? 16, justifyContent: f.align === 'center' ? 'center' : f.align === 'right' ? 'flex-end' : 'flex-start' }}>
        {f.content || f.label}
      </h3>
    );
  }
  if (f.type === 'body') {
    return (
      <p className="text-gray-500 whitespace-pre-wrap leading-relaxed w-full h-full overflow-auto" style={{ fontSize: f.fontSize ?? 14, textAlign: f.align ?? 'left' }}>
        {f.content || f.label}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full h-full">
      <label className="font-medium text-gray-600 flex-shrink-0" style={{ fontSize: Math.max(11, (f.fontSize ?? 14) - 1) }}>
        {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {f.type === 'text' && (
        <input type="text" disabled={readOnly} placeholder={f.placeholder}
          value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={base} style={fs} />
      )}
      {f.type === 'multitext' && (
        <textarea disabled={readOnly} placeholder={f.placeholder}
          value={value ?? ''} onChange={(e) => onChange?.(e.target.value)}
          className={cn(base, 'flex-1 resize-none min-h-0')} style={fs} />
      )}
      {f.type === 'number' && (
        <input type="number" disabled={readOnly} placeholder={f.placeholder}
          value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={base} style={fs} />
      )}
      {f.type === 'currency' && (
        <div className="relative">
          <input type="number" disabled={readOnly} placeholder={f.placeholder}
            value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={cn(base, 'pr-10')} style={fs} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
        </div>
      )}
      {f.type === 'date' && (
        <input type="date" disabled={readOnly}
          value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={base} style={fs} />
      )}
      {f.type === 'dropdown' && (
        <select disabled={readOnly}
          value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={cn(base, 'cursor-pointer')} style={fs}>
          <option value="">선택하세요</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {f.type === 'singleSelect' && (
        <div className="flex flex-col gap-1 overflow-auto min-h-0">
          {(f.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-gray-700 cursor-pointer" style={fs}>
              <input type="radio" disabled={readOnly} name={f.id} value={o}
                checked={value === o} onChange={() => onChange?.(o)} className="accent-primary-600" />
              {o}
            </label>
          ))}
          {(f.options ?? []).length === 0 && <span className="text-xs text-gray-300">옵션 없음</span>}
        </div>
      )}
      {f.type === 'checkbox' && (
        <div className="flex flex-col gap-1 overflow-auto min-h-0">
          {(f.options ?? []).map((o) => {
            const arr: string[] = value ?? [];
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-gray-700 cursor-pointer" style={fs}>
                <input type="checkbox" disabled={readOnly} checked={checked}
                  onChange={() => onChange?.(checked ? arr.filter((v) => v !== o) : [...arr, o])} className="accent-primary-600" />
                {o}
              </label>
            );
          })}
          {(f.options ?? []).length === 0 && <span className="text-xs text-gray-300">옵션 없음</span>}
        </div>
      )}

      {error && <p className="text-xs text-red-600 flex-shrink-0">{error}</p>}
    </div>
  );
}

// ── 렌더러 (미리보기/작성/읽기 전용) — 빌더에서 배치한 그리드 그대로 표시 ──
interface FormRendererProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange?: (fieldId: string, value: any) => void;
  readOnly?: boolean;
  errors?: Record<string, string>;
}

export function FormRenderer({ fields, values, onChange, readOnly, errors }: FormRendererProps) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 640 });
  const laid = ensureLayouts(fields);

  if (fields.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">아직 추가된 항목이 없습니다.</p>;
  }

  return (
    <div ref={containerRef}>
      <GridLayout
        width={width}
        layout={laid.map((f) => ({ i: f.id, ...f.layout!, static: true }))}
        gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_H, margin: [...GRID_MARGIN], containerPadding: [0, 0] }}
        dragConfig={{ enabled: false }}
        resizeConfig={{ enabled: false }}
      >
        {laid.map((f) => (
          <div key={f.id}>
            <FieldWidget
              field={f}
              value={values[f.id]}
              onChange={(v) => onChange?.(f.id, v)}
              readOnly={readOnly}
              error={errors?.[f.id]}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
