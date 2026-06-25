import { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronRight, ChevronDown, IndentIncrease, IndentDecrease, GripVertical, Calendar, Upload, Download, FileSpreadsheet, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { wbsApi, type WbsItem, type WbsStatus } from '../../api/wbs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { cn, formatDate } from '../../lib/utils';

interface ConfirmState {
  title: string;
  message: string;
  onConfirm: () => void;
}

const MAX_DEPTH = 3;

const STATUS_CONFIG: Record<WbsStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: '진행 전', color: 'bg-gray-100 text-gray-500' },
  IN_PROGRESS: { label: '진행 중', color: 'bg-blue-100 text-blue-600' },
  DONE:        { label: '완료',    color: 'bg-emerald-100 text-emerald-600' },
  ON_HOLD:     { label: '보류',    color: 'bg-amber-100 text-amber-600' },
};

// WBS 번호 계산 (1, 1.1, 1.1.1)
function calcWbsNumbers(items: WbsItem[]): Map<string, string> {
  const map = new Map<string, string>();
  const counters: number[] = [];
  for (const item of items) {
    const d = item.depth;
    while (counters.length <= d) counters.push(0);
    counters.length = d + 1;
    counters[d]++;
    map.set(item.id, counters.slice(0, d + 1).join('.'));
  }
  return map;
}

// D-Day 계산 (완료 상태이거나 progress 100이면 null 반환)
function calcDDay(endDate: string | null | undefined, progress: number): { label: string; color: string } | null {
  if (!endDate || progress >= 100) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: 'D-Day', color: 'bg-red-100 text-red-600 font-bold' };
  if (diff > 0)  return { label: `D-${diff}`, color: diff <= 3 ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-500' };
  return { label: `D+${Math.abs(diff)}`, color: 'bg-red-100 text-red-600 font-semibold' };
}

// 하위 항목 진행률 변경 시 상위 항목 평균 재계산
function calcAncestorUpdates(
  changedId: string,
  newProgress: number,
  items: WbsItem[],
): { id: string; progress: number }[] {
  const progressMap = new Map(items.map((i) => [i.id, i.progress]));
  progressMap.set(changedId, newProgress);

  const updates: { id: string; progress: number }[] = [];
  let current = items.find((i) => i.id === changedId);
  while (current?.parentId) {
    const parentId = current.parentId;
    const children = items.filter((i) => i.parentId === parentId);
    if (!children.length) break;
    const avg = Math.round(children.reduce((s, i) => s + (progressMap.get(i.id) ?? i.progress), 0) / children.length);
    progressMap.set(parentId, avg);
    updates.push({ id: parentId, progress: avg });
    current = items.find((i) => i.id === parentId);
  }
  return updates;
}

interface EditState {
  id: string;
  field: 'title' | 'assignee' | 'startDate' | 'endDate' | 'note';
  value: string;
}

// 숫자만 입력받아 YYYY-MM-DD 형태로 구분자 자동 삽입 (연도 입력 후 월/일로 자동 진행)
function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}

function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

// WBS 날짜 인라인 에디터 — 키보드 자동 포맷 입력 + 달력 버튼(네이티브 픽커)
function WbsDateEditor({ value, onChange, onCommit, onCancel, inputRef }: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex items-center gap-1 w-full">
      <input
        ref={inputRef}
        value={value}
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        maxLength={10}
        onChange={(e) => onChange(formatDateInput(e.target.value))}
        onBlur={onCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel(); }}
        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
      />
      <button
        type="button"
        title="달력에서 선택"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pickerRef.current?.showPicker?.()}
        className="flex-shrink-0 text-gray-400 hover:text-primary-600 transition-colors"
      >
        <Calendar size={14} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={isValidDate(value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        tabIndex={-1}
        className="absolute right-0 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}

export function WbsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Partial<WbsItem>[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['wbs', projectId],
    queryFn: () => wbsApi.getAll(projectId!),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['wbs', projectId] });

  const createMutation = useMutation({
    mutationFn: (data: Partial<WbsItem>) => wbsApi.create(projectId!, data),
    onSuccess: invalidate,
    onError: () => toast.error('추가 실패'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WbsItem> }) =>
      wbsApi.update(projectId!, id, data),
    onSuccess: invalidate,
    onError: () => toast.error('저장 실패'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wbsApi.remove(projectId!, id),
    onSuccess: invalidate,
    onError: () => toast.error('삭제 실패'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (items: Partial<WbsItem>[]) => wbsApi.bulkCreate(projectId!, items),
    onSuccess: (res) => {
      invalidate();
      setImportOpen(false);
      setImportRows(null);
      toast.success(`WBS ${res.count}개 항목이 추가되었습니다.`);
    },
    onError: () => toast.error('가져오기에 실패했습니다.'),
  });

  const STATUS_KO_MAP: Record<string, WbsStatus> = {
    '진행전': 'NOT_STARTED', '진행 전': 'NOT_STARTED',
    '진행중': 'IN_PROGRESS', '진행 중': 'IN_PROGRESS',
    '완료': 'DONE', '보류': 'ON_HOLD',
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { toast.error('데이터가 없습니다.'); return; }

        const HEADER: Record<string, string> = {
          '업무명': 'title', '단계': 'depth', '깊이': 'depth',
          '담당자': 'assignee', '시작일': 'startDate', '종료일': 'endDate',
          '진행률': 'progress', '상태': 'status', '비고': 'note',
        };

        const parsed: Partial<WbsItem>[] = rows.map((row) => {
          const item: any = {};
          for (const [k, v] of Object.entries(row)) {
            const field = HEADER[k.trim()];
            if (!field || v === '' || v == null) continue;
            if (field === 'depth') item.depth = Math.min(2, Math.max(0, Number(v)));
            else if (field === 'progress') item.progress = Math.min(100, Math.max(0, Number(v)));
            else if (field === 'status') item.status = STATUS_KO_MAP[String(v).trim()] ?? (Object.values(STATUS_KO_MAP).includes(v as any) ? v : 'NOT_STARTED');
            else if (field === 'startDate' || field === 'endDate') {
              const d = v instanceof Date ? v : new Date(String(v));
              if (!isNaN(d.getTime())) item[field] = d.toISOString().slice(0, 10);
            } else item[field] = String(v).trim();
          }
          return item;
        }).filter((i) => i.title);

        if (!parsed.length) { toast.error('업무명 열을 찾을 수 없습니다.'); return; }
        setImportRows(parsed);
      } catch {
        toast.error('파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['단계', '업무명', '담당자', '시작일', '종료일', '진행률', '상태', '비고'],
      [0, '기획', '홍길동', '2025-01-01', '2025-01-31', 0, '진행 전', ''],
      [1, '요구사항 분석', '홍길동', '2025-01-01', '2025-01-10', 50, '진행 중', ''],
      [1, '화면설계', '김철수', '2025-01-11', '2025-01-20', 0, '진행 전', ''],
      [0, '개발', '', '2025-02-01', '2025-03-31', 0, '진행 전', ''],
      [1, '백엔드 개발', '이영희', '2025-02-01', '2025-02-28', 0, '진행 전', ''],
      [2, 'API 설계', '이영희', '2025-02-01', '2025-02-07', 0, '진행 전', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WBS');
    XLSX.writeFile(wb, 'wbs_template.xlsx');
  };

  const exportWbs = () => {
    if (!rawItems.length) { toast.error('내보낼 WBS 항목이 없습니다.'); return; }
    const aoa = [
      ['WBS', '단계', '업무명', '담당자', '시작일', '종료일', '진행률', '상태', '비고'],
      ...rawItems.map((item) => [
        wbsNumbers.get(item.id) ?? '',
        item.depth,
        item.title, // 들여쓰기 없이 순수 제목 → 다시 가져오기 시 호환
        item.assignee ?? '',
        item.startDate ? item.startDate.slice(0, 10) : '',
        item.endDate ? item.endDate.slice(0, 10) : '',
        item.progress,
        STATUS_CONFIG[item.status ?? 'NOT_STARTED'].label,
        item.note ?? '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WBS');
    XLSX.writeFile(wb, 'wbs.xlsx');
  };

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; order: number; parentId: string | null; depth: number }[]) =>
      wbsApi.reorder(projectId!, items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ['wbs', projectId] });
      const prev = qc.getQueryData<WbsItem[]>(['wbs', projectId]);
      qc.setQueryData(['wbs', projectId], (old: WbsItem[] | undefined) => {
        if (!old) return old;
        const orderMap = new Map(items.map((i) => [i.id, i.order]));
        return [...old].sort((a, b) => (orderMap.get(a.id) ?? a.order) - (orderMap.get(b.id) ?? b.order));
      });
      return { prev };
    },
    onError: (_err, _items, ctx) => {
      if (ctx?.prev) qc.setQueryData(['wbs', projectId], ctx.prev);
    },
    onSettled: invalidate,
  });

  const visibleItems = rawItems.filter((item) => {
    if (!item.parentId) return true;
    let current = item;
    while (current.parentId) {
      const parent = rawItems.find((i) => i.id === current.parentId);
      if (!parent) break;
      if (collapsed.has(parent.id)) return false;
      current = parent;
    }
    return true;
  });

  const wbsNumbers = calcWbsNumbers(rawItems);

  const hasChildren = useCallback(
    (id: string) => rawItems.some((i) => i.parentId === id),
    [rawItems],
  );

  const startEdit = (id: string, field: EditState['field'], value: string) => {
    setEditState({ id, field, value });
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);
  };

  const commitEdit = () => {
    if (!editState) return;
    const { id, field, value } = editState;
    const item = rawItems.find((i) => i.id === id);
    if (!item) { setEditState(null); return; }
    const trimmed = value.trim();
    if (field === 'title' && !trimmed) { setEditState(null); return; }
    let data: Partial<WbsItem> = {};
    if (field === 'startDate' || field === 'endDate') {
      // 미완성/잘못된 날짜는 저장하지 않고 편집 취소
      if (trimmed && !isValidDate(trimmed)) { setEditState(null); return; }
      data = { [field]: trimmed || null } as any;
    } else {
      data = { [field]: trimmed || null } as any;
    }
    const unchanged = JSON.stringify((item as any)[field]) === JSON.stringify((data as any)[field]);
    if (!unchanged) updateMutation.mutate({ id, data });
    setEditState(null);
  };

  const handleProgressChange = (item: WbsItem, newProgress: number) => {
    updateMutation.mutate({ id: item.id, data: { progress: newProgress } });
    // 상위 항목 진행률 자동 반영
    const ancestorUpdates = calcAncestorUpdates(item.id, newProgress, rawItems);
    ancestorUpdates.forEach((u) => updateMutation.mutate({ id: u.id, data: { progress: u.progress } }));
  };

  const addRow = (afterItem?: WbsItem) => {
    const depth = afterItem?.depth ?? 0;
    const parentId = afterItem?.parentId ?? null;
    const order = afterItem ? afterItem.order + 1 : rawItems.length;
    createMutation.mutate({ title: '새 항목', depth, parentId: parentId ?? undefined, order });
  };

  const addChild = (parent: WbsItem) => {
    if (parent.depth >= MAX_DEPTH) return;
    createMutation.mutate({
      title: '새 하위 항목',
      depth: parent.depth + 1,
      parentId: parent.id,
      order: rawItems.filter((i) => i.parentId === parent.id).length,
    });
    setCollapsed((prev) => { const s = new Set(prev); s.delete(parent.id); return s; });
  };

  const indentItem = (item: WbsItem) => {
    const idx = rawItems.findIndex((i) => i.id === item.id);
    if (idx === 0 || item.depth >= MAX_DEPTH) return;
    const prev = rawItems[idx - 1];
    updateMutation.mutate({ id: item.id, data: { depth: item.depth + 1, parentId: prev.id } });
  };

  const outdentItem = (item: WbsItem) => {
    if (item.depth === 0) return;
    const parent = rawItems.find((i) => i.id === item.parentId);
    updateMutation.mutate({ id: item.id, data: { depth: item.depth - 1, parentId: parent?.parentId ?? null } });
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  };
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };
  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const currentDragId = dragId;
    setDragId(null); setDragOverId(null);
    if (!currentDragId || currentDragId === targetId) return;
    const from = rawItems.findIndex((i) => i.id === currentDragId);
    if (from === -1) return;

    // 드래그한 항목 + 그 하위 서브트리(더 깊은 depth가 연속되는 구간) 전체를 한 블록으로 이동.
    // 부모만 옮기고 자식은 남겨 트리가 분리되던 버그 방지.
    const dragged = rawItems[from];
    const block: WbsItem[] = [dragged];
    for (let i = from + 1; i < rawItems.length; i++) {
      if (rawItems[i].depth > dragged.depth) block.push(rawItems[i]);
      else break;
    }
    const blockIds = new Set(block.map((b) => b.id));
    // 자기 자신·자손 위로는 드롭 불가
    if (blockIds.has(targetId)) return;

    const rest = rawItems.filter((i) => !blockIds.has(i.id));
    const insertAt = rest.findIndex((i) => i.id === targetId);
    if (insertAt === -1) return;
    const reordered = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
    const updates = reordered.map((item, idx) => ({
      id: item.id, order: idx, parentId: item.parentId ?? null, depth: item.depth,
    }));
    reorderMutation.mutate(updates);
  };

  const progressColor = (p: number) =>
    p >= 100 ? 'bg-emerald-500' : p >= 60 ? 'bg-primary-500' : p >= 30 ? 'bg-amber-400' : 'bg-gray-300';

  const COLS = [
    { key: 'wbs',       label: 'WBS',  w: 'w-20 min-w-[5rem]' },
    { key: 'title',     label: '업무명', w: 'flex-1 min-w-[12rem]' },
    { key: 'assignee',  label: '담당자', w: 'w-24 min-w-[6rem]' },
    { key: 'startDate', label: '시작일', w: 'w-36 min-w-[9rem]' },
    { key: 'endDate',   label: '종료일', w: 'w-44 min-w-[11rem]' },
    { key: 'status',    label: '상태',  w: 'w-24 min-w-[6rem]' },
    { key: 'progress',  label: '진행률', w: 'w-32 min-w-[8rem]' },
    { key: 'note',      label: '비고',  w: 'w-36 min-w-[9rem]' },
    { key: 'actions',   label: '',     w: 'w-20 min-w-[5rem]' },
  ];

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" style={{ width: `${300 + i * 60}px` }} />
        ))}
      </div>
    </div>
  );

  // 전체 진행률은 말단(leaf) 항목만 평균 — 부모는 자식 평균을 이미 반영하므로 중복 가중 방지
  const leafItems = rawItems.filter((i) => !rawItems.some((c) => c.parentId === i.id));
  const totalAvg = leafItems.length
    ? Math.round(leafItems.reduce((s, i) => s + i.progress, 0) / leafItems.length)
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-700">WBS</h1>
          <p className="text-xs text-gray-400 mt-0.5">Work Breakdown Structure — 업무 분류 체계</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setImportOpen(true); setImportRows(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm transition-colors"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            엑셀 가져오기
          </button>
          <button
            onClick={exportWbs}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm transition-colors"
          >
            <Download size={15} className="text-gray-500" />
            엑셀 내보내기
          </button>
          <button
            onClick={() => addRow()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
          >
            <Plus size={15} />
            항목 추가
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1000px]">
          {/* Header Row */}
          <div className="flex items-center gap-0 bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
            {COLS.map((col) => (
              <div
                key={col.key}
                className={cn('px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200 last:border-r-0', col.w)}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                <Plus size={24} className="text-primary-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">WBS 항목이 없습니다</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">프로젝트 업무 분류를 등록해보세요</p>
              <button
                onClick={() => addRow()}
                className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                첫 항목 추가
              </button>
            </div>
          ) : (
            visibleItems.map((item) => {
              const isEditing = (field: EditState['field']) =>
                editState?.id === item.id && editState.field === field;
              const children = hasChildren(item.id);
              const isCollapsed = collapsed.has(item.id);
              const isDragging = dragId === item.id;
              const isDragOver = dragOverId === item.id;
              const depth = item.depth;
              const dday = calcDDay(item.endDate, item.progress);
              const isOverdue = !!dday && dday.label.startsWith('D+');
              const statusCfg = STATUS_CONFIG[item.status ?? 'NOT_STARTED'];

              return (
                <div
                  key={item.id}
                  onDragOver={(e) => onDragOver(e, item.id)}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null); }}
                  onDrop={(e) => onDrop(e, item.id)}
                  className={cn(
                    'flex items-center gap-0 border-b border-gray-100 group transition-all',
                    isDragging && 'opacity-40',
                    isDragOver && 'border-t-2 border-t-primary-400',
                    depth === 0 ? 'bg-white hover:bg-gray-50/80' : 'hover:bg-gray-50/60',
                    depth === 1 && 'bg-gray-50/40',
                    depth === 2 && 'bg-gray-50/60',
                    depth >= 3 && 'bg-gray-100/40',
                  )}
                >
                  {/* WBS 번호 — 드래그 핸들 */}
                  <div
                    draggable
                    onDragStart={(e) => onDragStart(e, item.id)}
                    className={cn('px-2 py-0 border-r border-gray-100 flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none', COLS[0].w)}
                    style={{ minHeight: 44 }}
                    title="드래그하여 순서 변경"
                  >
                    <GripVertical size={13} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                    <span className={cn(
                      'font-mono text-xs font-bold',
                      depth === 0 ? 'text-primary-600' : depth === 1 ? 'text-gray-600' : 'text-gray-400',
                    )}>
                      {wbsNumbers.get(item.id)}
                    </span>
                  </div>

                  {/* 업무명 */}
                  <div
                    className={cn('px-2 py-0 border-r border-gray-100 flex items-center gap-1', COLS[1].w)}
                    style={{ paddingLeft: `${depth * 20 + 8}px`, minHeight: 44 }}
                  >
                    {children ? (
                      <button
                        onClick={() => setCollapsed((prev) => {
                          const s = new Set(prev);
                          if (s.has(item.id)) s.delete(item.id); else s.add(item.id);
                          return s;
                        })}
                        className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
                      >
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      </button>
                    ) : (
                      <span className="w-4 flex-shrink-0" />
                    )}
                    {isEditing('title') ? (
                      <input
                        ref={inputRef}
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        className="flex-1 text-sm bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => startEdit(item.id, 'title', item.title)}
                        className={cn(
                          'flex-1 text-sm cursor-text truncate',
                          isOverdue
                            ? 'text-red-600 font-semibold'
                            : depth === 0 ? 'font-semibold text-gray-800' : depth === 1 ? 'font-medium text-gray-700' : 'text-gray-600',
                        )}
                      >
                        {item.title}
                      </span>
                    )}
                  </div>

                  {/* 담당자 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center', COLS[2].w)} style={{ minHeight: 44 }}>
                    {isEditing('assignee') ? (
                      <input
                        ref={inputRef}
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        placeholder="담당자"
                        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => startEdit(item.id, 'assignee', item.assignee ?? '')}
                        className="text-xs text-gray-600 cursor-text truncate w-full"
                      >
                        {item.assignee || <span className="text-gray-300">-</span>}
                      </span>
                    )}
                  </div>

                  {/* 시작일 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center', COLS[3].w)} style={{ minHeight: 44 }}>
                    {isEditing('startDate') ? (
                      <WbsDateEditor
                        value={editState!.value}
                        onChange={(v) => setEditState({ ...editState!, value: v })}
                        onCommit={commitEdit}
                        onCancel={() => setEditState(null)}
                        inputRef={inputRef}
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(item.id, 'startDate', item.startDate?.slice(0, 10) ?? '')}
                        className="text-xs text-gray-600 cursor-pointer hover:text-primary-600 transition-colors"
                      >
                        {item.startDate ? formatDate(item.startDate) : <span className="text-gray-300 hover:text-primary-400">날짜 선택</span>}
                      </span>
                    )}
                  </div>

                  {/* 종료일 + D-Day */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center gap-1.5', COLS[4].w)} style={{ minHeight: 44 }}>
                    {isEditing('endDate') ? (
                      <WbsDateEditor
                        value={editState!.value}
                        onChange={(v) => setEditState({ ...editState!, value: v })}
                        onCommit={commitEdit}
                        onCancel={() => setEditState(null)}
                        inputRef={inputRef}
                      />
                    ) : (
                      <>
                        <span
                          onClick={() => startEdit(item.id, 'endDate', item.endDate?.slice(0, 10) ?? '')}
                          className="text-xs text-gray-600 cursor-pointer hover:text-primary-600 transition-colors flex-shrink-0"
                        >
                          {item.endDate ? formatDate(item.endDate) : <span className="text-gray-300 hover:text-primary-400">날짜 선택</span>}
                        </span>
                        {dday && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0', dday.color)}>
                            {dday.label}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* 상태 */}
                  <div className={cn('px-2 py-0 border-r border-gray-100 flex items-center', COLS[5].w)} style={{ minHeight: 44 }}>
                    <div className={cn('relative w-full')}>
                      <span className={cn('text-xs px-2 py-1 rounded-full w-full text-center block', statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                      <select
                        value={item.status ?? 'NOT_STARTED'}
                        onChange={(e) => updateMutation.mutate({ id: item.id, data: { status: e.target.value as WbsStatus } })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      >
                        {(Object.keys(STATUS_CONFIG) as WbsStatus[]).map((k) => (
                          <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 진행률 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center gap-2', COLS[6].w)} style={{ minHeight: 44 }}>
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', progressColor(item.progress))}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <select
                        value={item.progress}
                        onChange={(e) => handleProgressChange(item, Number(e.target.value))}
                        className="text-xs font-semibold text-gray-600 bg-transparent border-none outline-none cursor-pointer w-14 text-right appearance-none"
                      >
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                          <option key={v} value={v}>{v}%</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 비고 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center', COLS[7].w)} style={{ minHeight: 44 }}>
                    {isEditing('note') ? (
                      <input
                        ref={inputRef}
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        placeholder="비고"
                        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => startEdit(item.id, 'note', item.note ?? '')}
                        className="text-xs text-gray-500 cursor-text truncate w-full"
                      >
                        {item.note || <span className="text-gray-300">-</span>}
                      </span>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className={cn('px-2 py-0 flex items-center justify-end gap-0.5', COLS[8].w)} style={{ minHeight: 44 }}>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {depth < MAX_DEPTH && (
                        <button
                          onClick={() => indentItem(item)}
                          title="들여쓰기"
                          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <IndentIncrease size={13} />
                        </button>
                      )}
                      {depth > 0 && (
                        <button
                          onClick={() => outdentItem(item)}
                          title="내어쓰기"
                          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <IndentDecrease size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => addChild(item)}
                        title="하위 항목 추가"
                        className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmState({
                          title: '항목 삭제',
                          message: `"${item.title}" 항목을 삭제하시겠습니까?`,
                          onConfirm: () => deleteMutation.mutate(item.id),
                        })}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* 하단 추가 버튼 */}
          {visibleItems.length > 0 && (
            <button
              onClick={() => addRow(rawItems[rawItems.length - 1])}
              className="w-full flex items-center gap-2 px-11 py-3 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-b border-gray-100 group"
            >
              <Plus size={14} className="group-hover:text-primary-500" />
              <span>항목 추가</span>
            </button>
          )}
        </div>
      </div>

      {/* 하단 요약 바 */}
      {rawItems.length > 0 && (
        <div className="flex-shrink-0 px-6 py-4 bg-white border-t-2 border-gray-200 flex items-center gap-8">
          {/* 항목 수 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xl font-bold text-gray-700">{rawItems.length}</span>
            <span className="text-[11px] text-gray-400">전체 항목</span>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          {/* 지연 */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xl font-bold text-red-500">
              {rawItems.filter(i => calcDDay(i.endDate, i.progress)?.label.startsWith('D+')).length}
            </span>
            <span className="text-[11px] text-gray-400">지연</span>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          {/* 전체 진행률 */}
          <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">전체 진행률</span>
              <span className="text-sm font-bold text-gray-700">{totalAvg}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${totalAvg}%` }} />
            </div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          {/* 상태별 카운트 */}
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(STATUS_CONFIG) as WbsStatus[]).map((k) => {
              const count = rawItems.filter(i => (i.status ?? 'NOT_STARTED') === k).length;
              return (
                <div key={k} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg', STATUS_CONFIG[k].color)}>
                  <span className="text-xs font-semibold">{STATUS_CONFIG[k].label}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 엑셀 가져오기 모달 ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setImportOpen(false); setImportRows(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800">엑셀로 WBS 가져오기</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">아래 형식으로 만든 엑셀을 업로드하면 WBS 항목이 자동 생성됩니다</p>
                </div>
              </div>
              <button onClick={() => { setImportOpen(false); setImportRows(null); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {!importRows ? (
                <>
                  {/* 레이아웃 가이드 - 미니 스프레드시트 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-600">📋 엑셀 컬럼 구성</p>
                      <button
                        onClick={downloadTemplate}
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Download size={12} /> 템플릿 다운로드
                      </button>
                    </div>
                    {/* 미니 스프레드시트 미리보기 */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            {['단계', '업무명', '담당자', '시작일', '종료일', '진행률', '상태', '비고'].map((h, i) => (
                              <th key={h} className={cn('px-3 py-2 text-left font-bold border-b border-r border-gray-200 last:border-r-0 whitespace-nowrap', i === 0 ? 'text-primary-600 bg-primary-50' : i === 1 ? 'text-gray-800' : 'text-gray-500 font-medium')}>
                                {h} {i < 2 && <span className="text-red-400">*</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['0', '기획', '홍길동', '2025-01-01', '2025-01-31', '0', '진행 전', ''],
                            ['1', '요구사항 분석', '홍길동', '2025-01-01', '2025-01-10', '50', '진행 중', ''],
                            ['1', '화면설계', '김철수', '', '', '0', '진행 전', '검토 필요'],
                            ['0', '개발', '', '2025-02-01', '', '0', '진행 전', ''],
                            ['1', '백엔드 개발', '이영희', '', '', '0', '진행 전', ''],
                            ['2', 'API 설계', '이영희', '', '', '0', '진행 전', ''],
                          ].map((row, ri) => (
                            <tr key={ri} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              {row.map((cell, ci) => (
                                <td key={ci} className={cn('px-3 py-1.5 border-r border-gray-100 last:border-r-0 text-gray-600',
                                  ci === 0 && 'font-bold text-center text-primary-600 bg-primary-50/40',
                                  ci === 1 && cell && `pl-${Number(row[0]) * 4 + 3}`,
                                )}>
                                  {ci === 1 && Number(row[0]) > 0 && (
                                    <span className="inline-block mr-1 text-gray-300">{'└'.repeat(Number(row[0]))}</span>
                                  )}
                                  {cell || <span className="text-gray-300">-</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* 컬럼 설명 */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-[11px] text-gray-500"><span className="font-semibold text-primary-600">단계</span>: 0=대그룹, 1=중그룹, 2=소그룹</span>
                      <span className="text-[11px] text-gray-500"><span className="font-semibold">상태</span>: 진행 전 / 진행 중 / 완료 / 보류</span>
                      <span className="text-[11px] text-gray-500"><span className="font-semibold">진행률</span>: 0~100 숫자</span>
                      <span className="text-[11px] text-red-400">* 필수</span>
                    </div>
                  </div>

                  {/* 파일 업로드 영역 */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseExcelFile(f); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                      dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50',
                    )}
                  >
                    <Upload size={28} className={cn('mx-auto mb-2', dragOver ? 'text-emerald-500' : 'text-gray-300')} />
                    <p className="text-sm font-medium text-gray-600">클릭하거나 파일을 드래그하세요</p>
                    <p className="text-xs text-gray-400 mt-1">.xlsx, .xls 파일 지원</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseExcelFile(f); e.target.value = ''; }} />
                  </div>
                </>
              ) : (
                /* 파싱 결과 미리보기 */
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-emerald-500" />
                    <span className="font-semibold text-gray-700">{importRows.length}개 항목을 읽었습니다</span>
                    <button onClick={() => setImportRows(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">다시 선택</button>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr>
                            {['단계', '업무명', '담당자', '시작일', '종료일', '진행률', '상태'].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-gray-200">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-1.5 font-bold text-primary-600 text-center">{row.depth ?? 0}</td>
                              <td className="px-3 py-1.5 text-gray-800 font-medium" style={{ paddingLeft: `${(row.depth ?? 0) * 12 + 12}px` }}>
                                {(row.depth ?? 0) > 0 && <span className="text-gray-300 mr-1">{'└'}</span>}{row.title}
                              </td>
                              <td className="px-3 py-1.5 text-gray-500">{row.assignee || '-'}</td>
                              <td className="px-3 py-1.5 text-gray-500">{row.startDate || '-'}</td>
                              <td className="px-3 py-1.5 text-gray-500">{row.endDate || '-'}</td>
                              <td className="px-3 py-1.5 text-gray-500">{row.progress ?? 0}%</td>
                              <td className="px-3 py-1.5 text-gray-500">{row.status ? STATUS_CONFIG[row.status as WbsStatus]?.label : '진행 전'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 푸터 */}
            {importRows && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button onClick={() => { setImportOpen(false); setImportRows(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
                <button
                  onClick={() => bulkCreateMutation.mutate(importRows)}
                  disabled={bulkCreateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  <FileSpreadsheet size={14} />
                  {bulkCreateMutation.isPending ? '추가 중...' : `${importRows.length}개 항목 추가`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message}
        confirmText="삭제"
        tone="danger"
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
