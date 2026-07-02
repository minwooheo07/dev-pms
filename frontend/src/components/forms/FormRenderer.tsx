import type { FormField } from '../../api/forms';
import { cn } from '../../lib/utils';

// 실제 제출 화면과 빌더 미리보기가 공유하는 렌더러.
// readOnly=true면 값 입력 불가(빌더 미리보기용), value/onChange로 실제 채움값 관리.
interface FormRendererProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange?: (fieldId: string, value: any) => void;
  readOnly?: boolean;
  errors?: Record<string, string>;
}

export function FormRenderer({ fields, values, onChange, readOnly, errors }: FormRendererProps) {
  const set = (id: string, v: any) => onChange?.(id, v);
  const base = 'w-full text-sm rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400';

  if (fields.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">아직 추가된 항목이 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => {
        if (f.type === 'title') {
          return <h3 key={f.id} className="text-base font-bold text-gray-800 pt-1">{f.content || f.label}</h3>;
        }
        if (f.type === 'body') {
          return <p key={f.id} className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{f.content || f.label}</p>;
        }

        const err = errors?.[f.id];
        return (
          <div key={f.id} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">
              {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {f.type === 'text' && (
              <input
                type="text" disabled={readOnly} placeholder={f.placeholder}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={base}
              />
            )}
            {f.type === 'multitext' && (
              <textarea
                disabled={readOnly} placeholder={f.placeholder} rows={4}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={cn(base, 'resize-y')}
              />
            )}
            {f.type === 'number' && (
              <input
                type="number" disabled={readOnly} placeholder={f.placeholder}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={base}
              />
            )}
            {f.type === 'currency' && (
              <div className="relative">
                <input
                  type="number" disabled={readOnly} placeholder={f.placeholder}
                  value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                  className={cn(base, 'pr-10')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
              </div>
            )}
            {f.type === 'date' && (
              <input
                type="date" disabled={readOnly}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={base}
              />
            )}
            {f.type === 'dropdown' && (
              <select
                disabled={readOnly}
                value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}
                className={cn(base, 'cursor-pointer')}
              >
                <option value="">선택하세요</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.type === 'singleSelect' && (
              <div className="flex flex-col gap-1.5">
                {(f.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
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
                    <label key={o} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
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
