import { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronRight, ChevronDown, IndentIncrease, IndentDecrease, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
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

export function WbsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      if (field === 'startDate' || field === 'endDate') {
        (inputRef.current as HTMLInputElement | null)?.showPicker?.();
      }
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
    const to = rawItems.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...rawItems];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
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

  const totalAvg = rawItems.length
    ? Math.round(rawItems.reduce((s, i) => s + i.progress, 0) / rawItems.length)
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-700">WBS</h1>
          <p className="text-xs text-gray-400 mt-0.5">Work Breakdown Structure — 업무 분류 체계</p>
        </div>
        <button
          onClick={() => addRow()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
        >
          <Plus size={15} />
          항목 추가
        </button>
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
                          depth === 0 ? 'font-semibold text-gray-800' : depth === 1 ? 'font-medium text-gray-700' : 'text-gray-600',
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
                      <input
                        ref={inputRef}
                        type="date"
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none"
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
                      <input
                        ref={inputRef}
                        type="date"
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none"
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
