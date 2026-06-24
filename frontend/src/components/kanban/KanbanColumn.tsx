import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { KanbanCard } from './KanbanCard';
import { useUiStore } from '../../store/ui.store';
import { stepsApi } from '../../api/notifications';
import { cn, STATUS_CONFIG } from '../../lib/utils';
import type { KanbanColumn as KanbanColumnType, TaskStatus } from '../../types';

const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'ON_HOLD', 'CANCELLED'];

interface KanbanColumnProps {
  column: KanbanColumnType;
  projectId: string;
  canManage?: boolean;
  currentUserId?: string;
  isOwner?: boolean;
}

export function KanbanColumn({ column, projectId, canManage, currentUserId, isOwner }: KanbanColumnProps) {
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const qc = useQueryClient();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column },
  });

  const deleteStep = useMutation({
    mutationFn: () => stepsApi.delete(projectId, column.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      toast.success('단계가 삭제되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const setStatus = useMutation({
    mutationFn: (status: TaskStatus) => stepsApi.update(projectId, column.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['project-stats', projectId] });
      qc.invalidateQueries({ queryKey: ['gantt', projectId] });
      toast.success('단계 상태가 변경되었습니다.');
    },
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  const handleDelete = () => {
    const msg = column.tasks.length
      ? `"${column.name}" 단계와 포함된 태스크 ${column.tasks.length}개가 모두 삭제됩니다. 계속하시겠습니까?`
      : `"${column.name}" 단계를 삭제하시겠습니까?`;
    if (confirm(msg)) deleteStep.mutate();
  };

  // status가 없거나(마이그레이션 전 데이터) 예상 밖 값이면 TODO로 폴백
  const statusKey: TaskStatus = column.status && STATUS_CONFIG[column.status] ? column.status : 'TODO';
  const statusCfg = { ...STATUS_CONFIG[statusKey], key: statusKey };

  return (
    <div className="flex flex-col w-72 flex-shrink-0 max-h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2 px-1 group">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
          <span className="text-xs font-semibold text-gray-600 truncate">{column.name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
            {column.tasks.length}
          </span>
          {/* 이 컬럼에 들어온 카드가 갖게 될 상태 (status 미정 시 TODO로 폴백) */}
          {canManage ? (
            <select
              value={statusCfg.key}
              onChange={(e) => setStatus.mutate(e.target.value as TaskStatus)}
              title="이 단계의 진행 상태 (카드를 옮기면 이 상태가 됩니다)"
              className={cn(
                'text-[10px] font-semibold border-0 rounded-full px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-400 flex-shrink-0',
                statusCfg.bg, statusCfg.color,
              )}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          ) : (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
              statusCfg.bg, statusCfg.color,
            )}>
              {statusCfg.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => openCreateTask(projectId, column.id)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
            title="태스크 추가"
          >
            <Plus size={14} />
          </button>
          {canManage && (
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
              title="단계 삭제"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto rounded-xl p-2 space-y-2 min-h-[120px] border-2 border-dashed transition-colors',
          isOver ? 'bg-primary-50/70 border-gray-300' : 'bg-gray-100/60 border-transparent',
        )}
      >
        <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              canDelete={isOwner || task.createdBy?.id === currentUserId}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <button
            onClick={() => openCreateTask(projectId, column.id)}
            className="w-full text-xs text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-300 hover:text-red-600 transition-colors cursor-pointer"
          >
            + 태스크 추가
          </button>
        )}
      </div>
    </div>
  );
}
