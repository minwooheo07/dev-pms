import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { KanbanCard } from './KanbanCard';
import { useUiStore } from '../../store/ui.store';
import { stepsApi } from '../../api/notifications';
import { cn } from '../../lib/utils';
import type { KanbanColumn as KanbanColumnType } from '../../types';

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

  const handleDelete = () => {
    const msg = column.tasks.length
      ? `"${column.name}" 단계와 포함된 태스크 ${column.tasks.length}개가 모두 삭제됩니다. 계속하시겠습니까?`
      : `"${column.name}" 단계를 삭제하시겠습니까?`;
    if (confirm(msg)) deleteStep.mutate();
  };

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2 px-1 group">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-xs font-semibold text-gray-700">{column.name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">
            {column.tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
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
              className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              title="단계 삭제 (오너/관리자)"
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
          'flex-1 rounded-xl p-2 space-y-2 min-h-[120px] border-2 border-dashed transition-colors',
          isOver ? 'bg-indigo-50/70 border-indigo-300' : 'bg-gray-100/60 border-transparent',
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
            className="w-full text-xs text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-500 transition-colors cursor-pointer"
          >
            + 태스크 추가
          </button>
        )}
      </div>
    </div>
  );
}
