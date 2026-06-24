import { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronRight, ChevronDown, IndentIncrease, IndentDecrease, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { wbsApi, type WbsItem } from '../../api/wbs';
import { cn, formatDate } from '../../lib/utils';

const MAX_DEPTH = 3;

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

interface EditState {
  id: string;
  field: 'title' | 'assignee' | 'startDate' | 'endDate' | 'progress' | 'note';
  value: string;
}

export function WbsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
    onSuccess: invalidate,
  });

  // 숨겨진 항목 필터링 (collapsed된 부모의 자식들 숨김)
  const visibleItems = rawItems.filter((item) => {
    if (!item.parentId) return true;
    // 부모 체인 중 collapsed된 게 있으면 숨김
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
    if (field === 'progress') {
      const n = Math.min(100, Math.max(0, parseInt(trimmed) || 0));
      data = { progress: n };
    } else if (field === 'startDate' || field === 'endDate') {
      data = { [field]: trimmed || null } as any;
    } else {
      data = { [field]: trimmed || null } as any;
    }

    const unchanged = JSON.stringify((item as any)[field]) === JSON.stringify((data as any)[field]);
    if (!unchanged) updateMutation.mutate({ id, data });
    setEditState(null);
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

  // Drag & Drop
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const from = rawItems.findIndex((i) => i.id === dragId);
    const to = rawItems.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...rawItems];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updates = reordered.map((item, idx) => ({
      id: item.id, order: idx, parentId: item.parentId ?? null, depth: item.depth,
    }));
    reorderMutation.mutate(updates);
    setDragId(null); setDragOverId(null);
  };

  const progressColor = (p: number) =>
    p >= 100 ? 'bg-emerald-500' : p >= 60 ? 'bg-primary-500' : p >= 30 ? 'bg-amber-400' : 'bg-gray-300';

  const COLS = [
    { key: 'wbs', label: 'WBS', w: 'w-24 min-w-[6rem]' },
    { key: 'title', label: '업무명', w: 'flex-1 min-w-[12rem]' },
    { key: 'assignee', label: '담당자', w: 'w-28 min-w-[7rem]' },
    { key: 'startDate', label: '시작일', w: 'w-28 min-w-[7rem]' },
    { key: 'endDate', label: '종료일', w: 'w-28 min-w-[7rem]' },
    { key: 'progress', label: '진행률', w: 'w-32 min-w-[8rem]' },
    { key: 'note', label: '비고', w: 'w-40 min-w-[10rem]' },
    { key: 'actions', label: '', w: 'w-20 min-w-[5rem]' },
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
        <div className="min-w-[900px]">
          {/* Table Header */}
          <div className="flex items-center gap-0 bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
            <div className="w-8 flex-shrink-0" /> {/* drag handle space */}
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
            visibleItems.map((item, idx) => {
              const isEditing = (field: EditState['field']) =>
                editState?.id === item.id && editState.field === field;
              const children = hasChildren(item.id);
              const isCollapsed = collapsed.has(item.id);
              const isDragging = dragId === item.id;
              const isDragOver = dragOverId === item.id;
              const depth = item.depth;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(item.id)}
                  onDragOver={(e) => onDragOver(e, item.id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => onDrop(item.id)}
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
                  {/* Drag handle */}
                  <div className="w-8 flex-shrink-0 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={14} className="text-gray-400" />
                  </div>

                  {/* WBS 번호 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center', COLS[0].w)} style={{ minHeight: 44 }}>
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
                    {/* 펼침/접힘 토글 */}
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
                        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
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

                  {/* 종료일 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center', COLS[4].w)} style={{ minHeight: 44 }}>
                    {isEditing('endDate') ? (
                      <input
                        ref={inputRef}
                        type="date"
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        className="w-full text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(item.id, 'endDate', item.endDate?.slice(0, 10) ?? '')}
                        className="text-xs text-gray-600 cursor-pointer hover:text-primary-600 transition-colors"
                      >
                        {item.endDate ? formatDate(item.endDate) : <span className="text-gray-300 hover:text-primary-400">날짜 선택</span>}
                      </span>
                    )}
                  </div>

                  {/* 진행률 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center gap-2', COLS[5].w)} style={{ minHeight: 44 }}>
                    {isEditing('progress') ? (
                      <input
                        ref={inputRef}
                        type="number"
                        min={0}
                        max={100}
                        value={editState!.value}
                        onChange={(e) => setEditState({ ...editState!, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                        className="w-16 text-xs bg-white border border-primary-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <div
                        className="flex items-center gap-2 w-full cursor-pointer"
                        onDoubleClick={() => startEdit(item.id, 'progress', String(item.progress))}
                      >
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', progressColor(item.progress))}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 w-8 text-right flex-shrink-0">
                          {item.progress}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 비고 */}
                  <div className={cn('px-3 py-0 border-r border-gray-100 flex items-center', COLS[6].w)} style={{ minHeight: 44 }}>
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
                  <div className={cn('px-2 py-0 flex items-center justify-end gap-0.5', COLS[7].w)} style={{ minHeight: 44 }}>
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
                        onClick={() => {
                          if (confirm(`"${item.title}" 항목을 삭제하시겠습니까?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
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
        <div className="flex-shrink-0 px-6 py-2.5 bg-white border-t border-gray-200 flex items-center gap-6 text-xs text-gray-400">
          <span>총 <strong className="text-gray-600">{rawItems.length}</strong>개 항목</span>
          <span>
            전체 진행률{' '}
            <strong className="text-gray-600">
              {Math.round(rawItems.reduce((s, i) => s + i.progress, 0) / rawItems.length)}%
            </strong>
          </span>
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-xs">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${Math.round(rawItems.reduce((s, i) => s + i.progress, 0) / rawItems.length)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
