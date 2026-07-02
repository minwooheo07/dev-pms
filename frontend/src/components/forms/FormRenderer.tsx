import type { FormField } from '../../api/forms';
import { cn } from '../../lib/utils';

// 실제 제출 화면과 빌더 미리보기가 공유하는 렌더러.
// readOnly=true면 값 입력 불가(빌더 미리보기용), value/onChange로 실제 채움값 관리.
// field.width(%)로 옆 항목과 나란히 배치, field.fontSize로 글자 크기, title/body는 align 지원.
interface FormRendererProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange?: (fieldId: string, value: any) => void;
  readOnly?: boolean;
  errors?: Record<string, string>;
}

export function FormRenderer({ fields, values, onChange, readOnly, errors }: FormRendererProps) {
  const set = (id: string, v: any) => onChange?.(id, v);
  const base = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400';

  if (fields.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">아직 추가된 항목이 없습니다.</p>;
  }

  // width% 기반 배치: 각 항목을 flex-wrap 행에 놓아 좁은 항목끼리 나란히 배치
  const wrapStyle = (f: FormField): React.CSSProperties => {
    const w = f.width ?? 100;
    return { flexBasis: `calc(${w}% - 12px)`, flexGrow: 0, flexShrink: 0 };
  };
  const inputFs = (f: FormField): React.CSSProperties =>
    f.fontSize ? { fontSize: f.fontSize } : { fontSize: 14 };

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-5">
      {fields.map((f) => {
        if (f.type === 'title') {
          return (
            <h3 key={f.id} className="font-bold text-gray-800 pt-1 w-full" style={{ ...wrapStyle(f), fontSize: f.fontSize ?? 16, textAlign: f.align ?? 'left' }}>
              {f.content || f.label}
            </h3>
          );
        }
        if (f.type === 'body') {
          return (
            <p key={f.id} className="text-gray-500 whitespace-pre-wrap leading-relaxed w-full" style={{ ...wrapStyle(f), fontSize: f.fontSize ?? 14, textAlign: f.align ?? 'left' }}>
              {f.content || f.label}
            </p>
          );
        }

        const err = errors?.[f.id];
        return (
          <div key={f.id} className="flex flex-col gap-1.5" style={wrapStyle(f)}>
            <label className="font-medium text-gray-600" style={{ fontSize: Math.max(11, (f.fontSize ?? 14) - 1) }}>
              {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {f.type === 'text' && (
              <input
                type="text" disabled={readOnly} placeholder={f.placeholder}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={base} style={inputFs(f)}
              />
            )}
            {f.type === 'multitext' && (
              <textarea
                disabled={readOnly} placeholder={f.placeholder} rows={4}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={cn(base, 'resize-y')} style={inputFs(f)}
              />
            )}
            {f.type === 'number' && (
              <input
                type="number" disabled={readOnly} placeholder={f.placeholder}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={base} style={inputFs(f)}
              />
            )}
            {f.type === 'currency' && (
              <div className="relative">
                <input
                  type="number" disabled={readOnly} placeholder={f.placeholder}
                  value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                  className={cn(base, 'pr-10')} style={inputFs(f)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
              </div>
            )}
            {f.type === 'date' && (
              <input
                type="date" disabled={readOnly}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={base} style={inputFs(f)}
              />
            )}
            {f.type === 'dropdown' && (
              <select
                disabled={readOnly}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={cn(base, 'cursor-pointer')} style={inputFs(f)}
              >
                <option value="">선택하세요</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.type === 'singleSelect' && (
              <div className="flex flex-col gap-1.5">
                {(f.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-gray-700 cursor-pointer" style={inputFs(f)}>
                    <input
                      type="radio" disabled={readOnly} name={f.id} value={o}
                      checked={values[f.id] === o} onChange={() => set(f.id, o)}
                      className="accent-primary-600"
                    />
                    {o}
                  </label>
                ))}
                {(f.options ?? []).length === 0 && <span className="text-xs text-gray-300">옵션 없음</span>}
              </div>
            )}
            {f.type === 'checkbox' && (
              <div className="flex flex-col gap-1.5">
                {(f.options ?? []).map((o) => {
                  const arr: string[] = values[f.id] ?? [];
                  const checked = arr.includes(o);
                  return (
                    <label key={o} className="flex items-center gap-2 text-gray-700 cursor-pointer" style={inputFs(f)}>
                      <input
                        type="checkbox" disabled={readOnly} checked={checked}
                        onChange={() => set(f.id, checked ? arr.filter((v) => v !== o) : [...arr, o])}
                        className="accent-primary-600"
                      />
                      {o}
                    </label>
                  );
                })}
                {(f.options ?? []).length === 0 && <span className="text-xs text-gray-300">옵션 없음</span>}
              </div>
            )}

            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}
