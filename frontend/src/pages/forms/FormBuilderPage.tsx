import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Save, GripVertical, Trash2, Plus, X, Eye, ListChecks,
  Heading, AlignLeft, Type, Text, Hash, Coins, CircleDot, ChevronDownSquare, CheckSquare, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formsApi, type FormField, type FormFieldType } from '../../api/forms';
import { FormRenderer } from '../../components/forms/FormRenderer';
import { cn } from '../../lib/utils';

const PALETTE: { type: FormFieldType; label: string; icon: any }[] = [
  { type: 'title', label: '제목', icon: Heading },
  { type: 'body', label: '본문 내용', icon: AlignLeft },
  { type: 'text', label: '텍스트', icon: Type },
  { type: 'multitext', label: '멀티텍스트', icon: Text },
  { type: 'number', label: '숫자', icon: Hash },
  { type: 'currency', label: '통화', icon: Coins },
  { type: 'singleSelect', label: '단일선택', icon: CircleDot },
  { type: 'dropdown', label: '드롭박스', icon: ChevronDownSquare },
  { type: 'checkbox', label: '체크박스', icon: CheckSquare },
  { type: 'date', label: '날짜', icon: Calendar },
];

const DEFAULT_LABEL: Record<FormFieldType, string> = {
  title: '섹션 제목', body: '안내 문구를 입력하세요', text: '텍스트 항목', multitext: '멀티텍스트 항목',
  number: '숫자 항목', currency: '금액 항목', singleSelect: '단일선택 항목', dropdown: '드롭박스 항목',
  checkbox: '체크박스 항목', date: '날짜 항목',
};

const HAS_OPTIONS: FormFieldType[] = ['singleSelect', 'dropdown', 'checkbox'];
const IS_DISPLAY_ONLY: FormFieldType[] = ['title', 'body'];

const uid = () => `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function newField(type: FormFieldType): FormField {
  const base: FormField = { id: uid(), type, label: DEFAULT_LABEL[type], required: false };
  if (HAS_OPTIONS.includes(type)) base.options = ['옵션 1', '옵션 2'];
  if (IS_DISPLAY_ONLY.includes(type)) base.content = DEFAULT_LABEL[type];
  return base;
}

export function FormBuilderPage() {
  const { projectId, formId } = useParams<{ projectId: string; formId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: form } = useQuery({
    queryKey: ['form', projectId, formId],
    queryFn: () => formsApi.get(projectId!, formId!),
    enabled: !!projectId && !!formId,
  });

  useEffect(() => {
    if (form && !loadedRef.current) {
      setFields(Array.isArray(form.schema) ? form.schema : []);
      setName(form.name);
      loadedRef.current = true;
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: (payload: { name?: string; schema?: FormField[] }) => formsApi.update(projectId!, formId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', projectId] }),
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  // 필드 변경 시 500ms 디바운스 자동 저장
  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate({ schema: fields }), 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const commitName = () => {
    setEditingName(false);
    if (name.trim() && name.trim() !== form?.name) saveMutation.mutate({ name: name.trim() });
    else if (!name.trim()) setName(form?.name ?? '');
  };

  const addField = (type: FormFieldType) => {
    const f = newField(type);
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  };

  const updateField = useCallback((id: string, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onDragStart = (idx: number) => { dragIndex.current = idx; };
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIndex(idx); };
  const onDrop = (idx: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null || from === idx) return;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
  };

  const selected = fields.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단바 */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm">
        <button onClick={() => navigate(`/forms?project=${projectId}`)} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={16} />
        </button>
        {editingName ? (
          <input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(form?.name ?? ''); setEditingName(false); } }}
            className="text-sm font-bold text-gray-700 border border-primary-400 rounded px-2 py-0.5 outline-none"
          />
        ) : (
          <span onDoubleClick={() => setEditingName(true)} className="text-sm font-bold text-gray-700 cursor-text" title="더블클릭해서 이름 변경">
            {name || '새 양식'}
          </span>
        )}
        <Save size={12} className={cn('transition-opacity duration-200', saveMutation.isPending ? 'text-gray-400 animate-pulse opacity-100' : 'opacity-0')} />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setPreview((v) => !v); setPreviewValues({}); }}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              preview ? 'bg-primary-50 border-gray-300 text-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300')}
          >
            <Eye size={14} /> 미리보기
          </button>
          <Link
            to={`/projects/${projectId}/forms/${formId}/submissions`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors"
          >
            <ListChecks size={14} /> 제출 목록
          </Link>
        </div>
      </div>

      {preview ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <FormRenderer fields={fields} values={previewValues} onChange={(id, v) => setPreviewValues((p) => ({ ...p, [id]: v }))} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측 팔레트 */}
          <div className="w-48 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-3">
            <p className="text-[11px] font-semibold text-gray-400 mb-2 px-1">위젯 (클릭하여 추가)</p>
            <div className="grid grid-cols-2 gap-2">
              {PALETTE.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => addField(type)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50/50 text-gray-500 hover:text-primary-600 transition-colors"
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 중앙 캔버스 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto flex flex-wrap gap-2">
              {fields.length === 0 && (
                <div className="w-full text-center py-16 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  좌측 위젯을 클릭해서 항목을 추가하세요
                </div>
              )}
              {fields.map((f, idx) => {
                const Icon = PALETTE.find((p) => p.type === f.type)?.icon ?? Type;
                const w = f.width ?? 100;
                return (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDrop={() => onDrop(idx)}
                    onClick={() => setSelectedId(f.id)}
                    style={{ flexBasis: `calc(${w}% - 8px)`, flexGrow: 0, flexShrink: 0 }}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-white cursor-pointer transition-colors',
                      selectedId === f.id ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300',
                      dragOverIndex === idx && 'border-t-2 border-t-primary-500',
                    )}
                  >
                    <GripVertical size={14} className="text-gray-300 cursor-grab flex-shrink-0" />
                    <Icon size={15} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{f.label}</p>
                      <p className="text-[11px] text-gray-400">
                        {PALETTE.find((p) => p.type === f.type)?.label}
                        {w !== 100 && <span className="ml-1 text-primary-500">· {WIDTH_OPTIONS.find((o) => o.value === w)?.label ?? `${w}%`}</span>}
                        {f.fontSize && <span className="ml-1 text-primary-500">· {f.fontSize}px</span>}
                      </p>
                    </div>
                    {f.required && <span className="text-[10px] text-red-500 flex-shrink-0">필수</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우측 속성 패널 */}
          <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-4">
            {!selected ? (
              <p className="text-xs text-gray-400 text-center mt-8">항목을 선택하면 속성을 편집할 수 있어요</p>
            ) : (
              <FieldProperties field={selected} onChange={(patch) => updateField(selected.id, patch)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const WIDTH_OPTIONS = [
  { value: 100, label: '전체' },
  { value: 75, label: '3/4' },
  { value: 66, label: '2/3' },
  { value: 50, label: '1/2' },
  { value: 33, label: '1/3' },
  { value: 25, label: '1/4' },
];

function FieldProperties({ field, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  const isDisplay = IS_DISPLAY_ONLY.includes(field.type);
  const hasOptions = HAS_OPTIONS.includes(field.type);

  const addOption = () => onChange({ options: [...(field.options ?? []), `옵션 ${(field.options?.length ?? 0) + 1}`] });
  const updateOption = (i: number, v: string) => onChange({ options: (field.options ?? []).map((o, idx) => (idx === i ? v : o)) });
  const removeOption = (i: number) => onChange({ options: (field.options ?? []).filter((_, idx) => idx !== i) });

  const defaultFs = field.type === 'title' ? 16 : 14;
  const fs = field.fontSize ?? defaultFs;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-400">{PALETTE.find((p) => p.type === field.type)?.label} 속성</p>

      {/* 폭 — 좁히면 옆 항목과 나란히 배치 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">폭 (좁히면 옆 항목과 나란히 배치)</label>
        <div className="grid grid-cols-3 gap-1">
          {WIDTH_OPTIONS.map((w) => (
            <button
              key={w.value}
              onClick={() => onChange({ width: w.value })}
              className={cn(
                'text-xs px-2 py-1.5 rounded-lg border transition-colors',
                (field.width ?? 100) === w.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300',
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* 글자 크기 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">글자 크기 <span className="text-gray-400">{fs}px</span></label>
        <div className="flex items-center gap-2">
          <input
            type="range" min={10} max={28} step={1} value={fs}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="flex-1 accent-primary-600"
          />
          <button
            onClick={() => onChange({ fontSize: undefined })}
            className="text-[11px] text-gray-400 hover:text-gray-600"
            title="기본값으로"
          >초기화</button>
        </div>
      </div>

      {/* 정렬 — 제목/본문만 */}
      {isDisplay && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">정렬</label>
          <div className="grid grid-cols-3 gap-1">
            {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => onChange({ align: v })}
                className={cn(
                  'text-xs px-2 py-1.5 rounded-lg border transition-colors',
                  (field.align ?? 'left') === v
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">{isDisplay ? '내용' : '라벨'}</label>
        {isDisplay ? (
          <textarea
            value={field.content ?? ''} onChange={(e) => onChange({ content: e.target.value })}
            rows={field.type === 'title' ? 1 : 3}
            className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        ) : (
          <input
            value={field.label} onChange={(e) => onChange({ label: e.target.value })}
            className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
          />
        )}
      </div>

      {!isDisplay && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">플레이스홀더</label>
          <input
            value={field.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {!isDisplay && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ required: e.target.checked })} className="accent-primary-600" />
          필수 입력
        </label>
      )}

      {hasOptions && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">선택 옵션</label>
          {(field.options ?? []).map((o, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={o} onChange={(e) => updateOption(i, e.target.value)}
                className="flex-1 text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-500 p-1"><X size={13} /></button>
            </div>
          ))}
          <button onClick={addOption} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-1">
            <Plus size={12} /> 옵션 추가
          </button>
        </div>
      )}
    </div>
  );
}
