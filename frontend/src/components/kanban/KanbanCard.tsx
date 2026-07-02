import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Paperclip, CalendarDays, GitBranch, Trash2, AlertTriangle, X, ChevronRight, ChevronDown, ClipboardList } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge } from '../ui/PriorityBadge';
import { IssueEditModal } from '../issue/IssueEditModal';
import type { IssueEditTarget } from '../issue/IssueEditModal';
import { useUiStore } from '../../store/ui.store';
import { tasksApi } from '../../api/tasks';
import { formatDueDate, isDueDateOverdue, cn } from '../../lib/utils';
import type { Task, IssueRisk, IssueStatus } from '../../types';

const RISK_CONFIG: Record<IssueRisk, { label: string; color: string; bg: string; dot: string }> = {
  LOW:      { label: '낮음',  color: 'text-green-700',  bg: 'bg-green-50',  dot: 'bg-green-500' },
  MEDIUM:   { label: '보통',  color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-500' },
  HIGH:     { label: '높음',  color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  CRITICAL: { label: '심각',  color: 'text-red-700',    bg: 'bg-red-50',    dot: 'bg-red-500' },
};

const STATUS_LABEL: Record<IssueStatus, string> = {
  OPEN: '미해결', IN_REVIEW: '검토중', RESOLVED: '해결됨', ON_HOLD: '보류',
};

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

  const style = { transform: CSS.Transform.toString(transform), transition };

  const isOverdue = isDueDateOverdue(task.dueDate);
  const hasIssue = task._count.issues > 0;
  const wlStats = task.workLogStats;
  const issues = task.issues ?? [];
  const hasUnresolvedIssue = issues.some((i) => i.status !== 'RESOLVED');

  const [issuePopover, setIssuePopover] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueEditTarget | null>(null);
  const [expanded, setExpanded] = useState(false);

  const subTasks = task.subTasks ?? [];
  const doneSubs = subTasks.filter((s) => s.status === 'DONE').length;
  const badgeRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });

  const openIssuePopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    setPopPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 280) });
    setIssuePopover(true);
  };

  useEffect(() => {
    if (!issuePopover) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        badgeRef.current && !badgeRef.current.contains(e.target as Node)
      ) setIssuePopover(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [issuePopover]);

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(task.projectId, task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', task.projectId] });
      toast.success('태스크가 삭제되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => openTaskModal(task.id, true)}
        className={cn(
          'rounded-xl border bg-white p-3 cursor-pointer select-none relative',
          'transition-all duration-200',
          'outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
          hasUnresolvedIssue
            ? 'border-red-200 animate-issue-glow hover:border-red-300'
            : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300',
          isDragging && 'opacity-40',
          overlay && 'shadow-xl rotate-1',
        )}
      >
        {/* 우측 상단: 담당자 아바타 + hover 시 삭제 버튼 */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          {canDelete && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`"${task.title}" 태스크를 삭제하시겠습니까?`)) deleteTask.mutate();
              }}
              className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-gray-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-all z-10"
              title="태스크 삭제"
            >
              <Trash2 size={12} />
            </button>
          )}
          {task.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map(({ user }) => (
                <Avatar key={user.id} name={user.name} avatar={user.avatar} size="xs" className="ring-2 ring-white" />
              ))}
            </div>
          )}
        </div>

        {/* 라벨 */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels.map(({ label }) => (
              <span
                key={label.id}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
                style={{ backgroundColor: label.color + '18', color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* 제목 */}
        <p className="text-[13px] font-semibold text-gray-800 leading-snug mb-2 pr-16 group-hover:text-gray-600 transition-colors">
          {task.part && (
            <span className="inline-block text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 mr-1.5 align-middle leading-none">{task.part}</span>
          )}
          {task.title}
        </p>

        {/* 설명 */}
        {task.description && (
          <p className="text-[11px] text-gray-400 mb-2.5 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {/* 배지 행 */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {/* 이슈 배지 */}
          {hasIssue && (
            <button
              ref={badgeRef}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={openIssuePopover}
              title="연결된 이슈 보기"
              className="flex items-center gap-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all active:scale-95"
            >
              <AlertTriangle size={9} strokeWidth={2.5} />
              이슈 {task._count.issues}
            </button>
          )}

          {/* 우선순위 */}
          <PriorityBadge priority={task.priority} />

          {/* 마감일 */}
          {task.dueDate && (
            <span className={cn(
              'flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold',
              isOverdue
                ? 'bg-red-100 text-red-600 border border-red-200'
                : 'bg-blue-50 text-blue-600 border border-blue-100',
            )}>
              <CalendarDays size={9} />
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {/* 서브태스크 (클릭 시 펼침/접기) */}
          {task._count.subTasks > 0 && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="flex items-center gap-0.5 text-[10px] text-gray-500 font-medium hover:text-primary-600 bg-gray-50 hover:bg-primary-50 border border-gray-200 px-1.5 py-0.5 rounded-full transition-colors"
              title="하위 태스크 펼치기"
            >
              {expanded ? <ChevronDown size={10} /> : <GitBranch size={10} />}
              {doneSubs}/{task._count.subTasks}
            </button>
          )}
        </div>

        {/* 하단 푸터 */}
        {(task._count.comments > 0 || task._count.attachments > 0 || (wlStats && wlStats.total > 0)) && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
            {task._count.comments > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                <MessageSquare size={10} /> {task._count.comments}
              </span>
            )}
            {task._count.attachments > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                <Paperclip size={10} /> {task._count.attachments}
              </span>
            )}

            {/* 우측 하단: 워크로드 일감 완료/전체 — 지연 시 앰버 + ping 점 */}
            {wlStats && wlStats.total > 0 && (
              <span
                title={wlStats.overdue
                  ? `마감일 경과 · 완료 이상이 아닌 일감 ${wlStats.total - wlStats.completed}건`
                  : `일감 완료 ${wlStats.completed} / 전체 ${wlStats.total}`}
                className={cn(
                  'ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  wlStats.overdue
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : wlStats.completed === wlStats.total
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200',
                )}
              >
                {wlStats.overdue && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                )}
                <ClipboardList size={9} strokeWidth={2.5} />
                {wlStats.completed}/{wlStats.total}
              </span>
            )}
          </div>
        )}

        {/* 펼쳐진 하위 태스크 목록 */}
        {expanded && subTasks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            {subTasks.map((sub) => {
              const subDone = sub.status === 'DONE';
              return (
                <button
                  key={sub.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); openTaskModal(sub.id); }}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group/sub"
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', subDone ? 'bg-emerald-500' : 'bg-gray-300')} />
                  <span className={cn('flex-1 min-w-0 truncate text-[11px]', subDone ? 'text-gray-400 line-through' : 'text-gray-700 group-hover/sub:text-primary-600')}>
                    {sub.title}
                  </span>
                  {sub.assignees.length > 0 && (
                    <div className="flex -space-x-1 flex-shrink-0">
                      {sub.assignees.slice(0, 2).map(({ user }) => (
                        <Avatar key={user.id} name={user.name} avatar={user.avatar} size="xs" className="ring-1 ring-white" />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 이슈 수정 모달 */}
      {editingIssue && createPortal(
        <IssueEditModal
          projectId={task.projectId}
          issue={editingIssue}
          onClose={() => setEditingIssue(null)}
        />,
        document.body,
      )}

      {/* 이슈 팝오버 */}
      {issuePopover && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up"
          style={{ top: popPos.top, left: popPos.left }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center bg-red-100">
                <AlertTriangle size={11} className="text-red-500" />
              </div>
              <span className="text-xs font-bold text-gray-700">연결된 이슈</span>
              <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
                {issues.length}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setIssuePopover(false); }}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {issues.map((issue) => {
              const risk = RISK_CONFIG[issue.riskLevel];
              const isResolved = issue.status === 'RESOLVED';
              return (
                <button
                  key={issue.id}
                  className="w-full text-left px-3 py-2.5 hover:bg-red-50/50 transition-colors group/item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIssuePopover(false);
                    setEditingIssue({ ...issue, taskId: issue.taskId ?? task.id });
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', risk.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-medium leading-snug', isResolved ? 'text-gray-400 line-through' : 'text-gray-800 group-hover/item:text-red-600')}>
                        {issue.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', risk.color, risk.bg)}>
                          {risk.label}
                        </span>
                        <span className={cn('text-[10px] font-medium',
                          issue.status === 'OPEN' ? 'text-red-500' :
                          issue.status === 'IN_REVIEW' ? 'text-blue-500' :
                          issue.status === 'RESOLVED' ? 'text-green-500' : 'text-gray-400',
                        )}>
                          {STATUS_LABEL[issue.status]}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-gray-300 group-hover/item:text-red-400 flex-shrink-0 mt-1 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
