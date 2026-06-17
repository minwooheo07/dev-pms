import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Paperclip, CalendarDays, GitBranch, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge } from '../ui/PriorityBadge';
import { useUiStore } from '../../store/ui.store';
import { tasksApi } from '../../api/tasks';
import { formatDueDate, isDueDateOverdue, cn } from '../../lib/utils';
import type { Task } from '../../types';

interface KanbanCardProps {
  task: Task;
  overlay?: boolean;
  canDelete?: boolean;
}

export function KanbanCard({ task, overlay, canDelete }: KanbanCardProps) {
  const openTaskModal = useUiStore((s) => s.openTaskModal);
  const qc = useQueryClient();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = isDueDateOverdue(task.dueDate);

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(task.projectId, task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', task.projectId] });
      toast.success('태스크가 삭제되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => openTaskModal(task.id)}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group select-none relative',
        'outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
        isDragging && 'opacity-40',
        overlay && 'shadow-xl rotate-1',
      )}
    >
      {/* Delete button */}
      {canDelete && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`"${task.title}" 태스크를 삭제하시겠습니까?`)) {
              deleteTask.mutate();
            }
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 rounded transition-all z-10"
          title="태스크 삭제"
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map(({ label }) => (
            <span
              key={label.id}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: label.color + '20', color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-medium text-gray-900 leading-snug mb-2 group-hover:text-indigo-700 transition-colors pr-5">
        {task.title}
      </p>

      {task.description && (
        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cn(
            'flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full font-medium',
            isOverdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500',
          )}>
            <CalendarDays size={10} />
            {formatDueDate(task.dueDate)}
          </span>
        )}
        {task._count.subTasks > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
            <GitBranch size={10} /> {task._count.subTasks}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task._count.comments > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
              <MessageSquare size={10} /> {task._count.comments}
            </span>
          )}
          {task._count.attachments > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
              <Paperclip size={10} /> {task._count.attachments}
            </span>
          )}
        </div>
        <div className="flex -space-x-1">
          {task.assignees.slice(0, 3).map(({ user }) => (
            <Avatar key={user.id} name={user.name} avatar={user.avatar} size="xs" className="ring-1 ring-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
