import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, getFirstCollision,
} from '@dnd-kit/core';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent, CollisionDetection } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ChevronRight, Plus, LayoutGrid, List, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksApi } from '../../api/tasks';
import { getAccessToken } from '../../utils/token';
import { stepsApi } from '../../api/notifications';
import { projectsApi } from '../../api/projects';
import { KanbanColumn } from '../../components/kanban/KanbanColumn';
import { KanbanCard } from '../../components/kanban/KanbanCard';
import { CreateTaskModal } from '../../components/task/CreateTaskModal';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { BulkImportModal } from '../../components/task/BulkImportModal';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { cn, STATUS_CONFIG } from '../../lib/utils';
import type { KanbanColumn as KanbanColumnType, Task, TaskStatus } from '../../types';

export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const taskModalId = useUiStore((s) => s.taskModalId);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [partFilter, setPartFilter] = useState<string>('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  const currentUser = useAuthStore((s) => s.user);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId!),
    enabled: !!projectId,
  });

  const myRole = project?.members.find((m) => m.user.id === currentUser?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  const { data: kanban, isLoading, isError, refetch } = useQuery({
    queryKey: ['kanban', projectId],
    queryFn: () => tasksApi.getKanban(projectId!),
    enabled: !!projectId,
  });

  // SSE: 다른 사람이 태스크 변경 시 실시간 갱신
  useEffect(() => {
    if (!projectId || !currentUser) return;
    const token = getAccessToken();
    const url = `/api/projects/${projectId}/tasks/events${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['project-stats', projectId] });
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [projectId, currentUser, qc]);

  const moveTask = useMutation({
    mutationFn: ({ taskId, stepId, order }: { taskId: string; stepId: string | null; order: number }) =>
      tasksApi.move(projectId!, taskId, stepId, order),
    onSuccess: (data, { taskId }) => {
      qc.setQueryData(['task', taskId], data);
      qc.invalidateQueries({ queryKey: ['project-stats', projectId] });
      qc.invalidateQueries({ queryKey: ['gantt', projectId] });
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message ?? '단계 이동에 실패했습니다.');
    },
    // 성공/실패 무관하게 서버 상태로 동기화(낙관적 업데이트 정합성 보장)
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
    },
  });

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const addColumn = useMutation({
    mutationFn: (name: string) => stepsApi.create(projectId!, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      setNewColumnName('');
      setAddingColumn(false);
      toast.success('단계가 추가되었습니다.');
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const collisionDetection = useCallback((args: any) => {
    const pointerCollisions = pointerWithin(args);
    const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    if (collisions.length === 0) return [];
    // 컬럼보다 태스크 충돌을 우선 → 컬럼 안에서 카드 사이에 정확히 끼워넣기 가능
    const isColumn = (c: any) => kanban?.some((col) => col.id === c.id);
    const taskHit = collisions.find((c: any) => !isColumn(c));
    if (taskHit) return [taskHit];
    return collisions.length > 0 ? [collisions[0]] : [];
  }, [kanban]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    setActiveTask(task ?? null);
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !kanban) return;

    const taskId = active.id as string;
    const overType = over.data.current?.type;

    let targetStepId: string | null = null;
    let targetOrder = 0;

    if (overType === 'column') {
      targetStepId = over.id as string;
      const col = kanban.find((c) => c.id === targetStepId);
      targetOrder = col?.tasks.length ?? 0;
    } else if (overType === 'task') {
      const overTask = over.data.current?.task as Task;
      targetStepId = overTask.stepId ?? null;
      const col = kanban.find((c) => c.id === targetStepId);
      if (col) {
        const idx = col.tasks.findIndex((t) => t.id === over.id);
        targetOrder = idx;
      }
    }

    qc.setQueryData(['kanban', projectId], (old: KanbanColumnType[] | undefined) => {
      if (!old) return old;
      return old.map((col) => {
        let tasks = col.tasks.filter((t) => t.id !== taskId);
        if (col.id === targetStepId) {
          const movedTask = kanban.flatMap((c) => c.tasks).find((t) => t.id === taskId);
          if (movedTask) {
            tasks = [...tasks.slice(0, targetOrder), { ...movedTask, stepId: targetStepId }, ...tasks.slice(targetOrder)];
          }
        }
        return { ...col, tasks };
      });
    });

    // 단계로 옮기면 백엔드가 그 단계의 status를 자동 적용 (status는 단계를 따라감)
    moveTask.mutate({ taskId, stepId: targetStepId, order: targetOrder });
  }, [kanban, projectId, qc, moveTask]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link to="/projects" className="hover:text-gray-600">프로젝트</Link>
          <ChevronRight size={14} />
          <Link to={`/projects/${projectId}`} className="hover:text-gray-600">{project?.name}</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">칸반보드</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">각 컬럼의 + 버튼으로 태스크를 추가하세요</span>
          {canManage && (
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm transition-colors"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              엑셀 일괄등록
            </button>
          )}
        </div>
      </div>

      {/* 업무파트 필터 */}
      {(() => {
        const parts = [...new Set(
          (kanban ?? []).flatMap((col) => col.tasks.map((t) => t.part)).filter(Boolean)
        )] as string[];
        if (parts.length === 0) return null;
        return (
          <div className="flex-shrink-0 flex items-center gap-2 px-6 py-2 bg-white border-b border-gray-100 overflow-x-auto">
            <span className="text-xs font-semibold text-gray-400 flex-shrink-0">업무파트</span>
            <button
              onClick={() => setPartFilter('')}
              className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors flex-shrink-0',
                partFilter === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              )}
            >전체</button>
            {parts.map((p) => (
              <button
                key={p}
                onClick={() => setPartFilter(partFilter === p ? '' : p)}
                className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors flex-shrink-0 whitespace-nowrap',
                  partFilter === p ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200 hover:border-primary-400 hover:text-primary-600'
                )}
              >{p}</button>
            ))}
          </div>
        );
      })()}

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="w-72 h-64 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
            ))
          ) : isError ? (
            <div className="flex-1 flex items-center justify-center">
              <ErrorState onRetry={refetch} />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {kanban?.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={partFilter ? { ...column, tasks: column.tasks.filter((t) => t.part === partFilter) } : column}
                  projectId={projectId!}
                  canManage={canManage}
                  currentUserId={currentUser?.id}
                  isOwner={myRole === 'OWNER'}
                />
              ))}
              <DragOverlay>
                {activeTask && <KanbanCard task={activeTask} overlay />}
              </DragOverlay>
            </DndContext>
          )}

          {/* Add column */}
          {!isLoading && (
            <div className="w-72 flex-shrink-0">
              {addingColumn ? (
                <div className="bg-gray-100/60 rounded-xl p-2">
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newColumnName.trim()) addColumn.mutate(newColumnName.trim());
                      if (e.key === 'Escape') { setAddingColumn(false); setNewColumnName(''); }
                    }}
                    placeholder="단계 이름 (예: 이슈)"
                    className="w-full text-sm rounded-lg border border-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" variant="primary" onClick={() => newColumnName.trim() && addColumn.mutate(newColumnName.trim())}>
                      추가
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingColumn(false); setNewColumnName(''); }}>
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Plus size={15} /> 단계 추가
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateTaskModal />
      <TaskDetailModal />
      {showBulkImport && <BulkImportModal projectId={projectId!} onClose={() => setShowBulkImport(false)} />}
    </div>
  );
}
