import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ChevronRight, Calendar, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksApi } from '../../api/tasks';
import { projectsApi } from '../../api/projects';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Avatar } from '../../components/ui/Avatar';
import { CreateTaskModal } from '../../components/task/CreateTaskModal';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { useUiStore } from '../../store/ui.store';
import { formatDate, cn, isDueDateOverdue } from '../../lib/utils';
import { addDays, differenceInDays, startOfDay, startOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task } from '../../types';

function GanttBar({ task, startDate, totalDays }: { task: Task; startDate: Date; totalDays: number }) {
  const openTaskModal = useUiStore((s) => s.openTaskModal);

  if (!task.startDate && !task.dueDate) return null;

  const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
  const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate!);

  const offsetDays = Math.max(0, differenceInDays(taskStart, startDate));
  const durationDays = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
  const leftPct = (offsetDays / totalDays) * 100;
  const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);
  const isOverdue = isDueDateOverdue(task.dueDate);

  return (
    <button
      onClick={() => openTaskModal(task.id)}
      className={cn(
        'absolute top-1.5 h-7 rounded-md flex items-center px-2 text-xs font-medium text-white shadow-sm hover:brightness-110 transition-all cursor-pointer truncate',
        isOverdue ? 'bg-red-500' : 'bg-primary-500',
      )}
      style={{
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 3)}%`,
      }}
      title={task.title}
    >
      {durationDays > 2 && task.title}
    </button>
  );
}

export function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem('accessToken');
    const url = `/api/projects/${projectId}/tasks/events${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = () => {
      qc.invalidateQueries({ queryKey: ['gantt', projectId] });
      qc.invalidateQueries({ queryKey: ['project-stats', projectId] });
    };
    es.onerror = () => {};
    return () => es.close();
  }, [projectId, qc]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks, isLoading, isError, refetch } = useQuery({
    queryKey: ['gantt', projectId],
    queryFn: () => tasksApi.getGantt(projectId!),
    enabled: !!projectId,
  });

  // 드래그 정렬용 로컬 순서 (서버 데이터와 동기화)
  const [ordered, setOrdered] = useState<Task[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  useEffect(() => { if (tasks) setOrdered(tasks); }, [tasks]);

  const reorder = useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.reorderGantt(projectId!, taskIds),
    onError: () => {
      toast.error('순서 저장에 실패했습니다.');
      qc.invalidateQueries({ queryKey: ['gantt', projectId] });
    },
  });

  const handleDrop = () => {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null); setOverIndex(null);
      return;
    }
    const next = [...ordered];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(overIndex, 0, moved);
    setOrdered(next);
    // 낙관적 캐시 갱신 — 재요청/ SSE refetch가 와도 순서 유지
    qc.setQueryData(['gantt', projectId], next);
    reorder.mutate(next.map((t) => t.id));
    setDragIndex(null); setOverIndex(null);
  };

  const openTaskModal = useUiStore((s) => s.openTaskModal);

  const today = startOfDay(new Date());
  const timelineStart = project?.startDate ? startOfDay(new Date(project.startDate)) : addDays(today, -7);
  const timelineEnd = project?.endDate ? startOfDay(new Date(project.endDate)) : addDays(today, 60);
  const totalDays = Math.max(differenceInDays(timelineEnd, timelineStart) + 1, 30);

  const dateHeaders: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    dateHeaders.push(addDays(timelineStart, i));
  }

  const weekHeaders: { label: string; span: number }[] = [];
  let currentWeek = '';
  let span = 0;
  dateHeaders.forEach((d, idx) => {
    // 해당 주의 월요일을 기준으로 "M월 d일" 라벨 생성 (W 토큰은 date-fns 미지원)
    const weekStart = startOfWeek(d, { weekStartsOn: 1 });
    const week = format(weekStart, 'M월 d일', { locale: ko });
    if (week !== currentWeek) {
      if (currentWeek) weekHeaders.push({ label: currentWeek, span });
      currentWeek = week;
      span = 1;
    } else {
      span++;
    }
    if (idx === dateHeaders.length - 1) weekHeaders.push({ label: currentWeek, span });
  });

  const colWidth = 40;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link to="/projects" className="hover:text-gray-600">프로젝트</Link>
          <ChevronRight size={14} />
          <Link to={`/projects/${projectId}`} className="hover:text-gray-600">{project?.name}</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">간트차트</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <LoadingSpinner className="py-24" text="간트차트 불러오는 중..." />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <div className="flex min-h-full">
            {/* Task list */}
            <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white">
              <div className="h-16 border-b border-gray-200 px-4 flex items-end pb-2">
                <span className="text-xs font-semibold text-gray-500">태스크</span>
              </div>
              <div>
                {ordered.map((task, idx) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => { e.preventDefault(); if (overIndex !== idx) setOverIndex(idx); }}
                    onDrop={handleDrop}
                    onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                    className={cn(
                      'group flex items-center gap-1.5 px-2 py-2.5 border-b border-gray-100 h-11 hover:bg-gray-50 cursor-pointer transition-colors',
                      dragIndex === idx && 'opacity-40',
                      overIndex === idx && dragIndex !== idx && 'bg-primary-50 border-t-2 border-t-primary-400',
                    )}
                    onClick={() => openTaskModal(task.id)}
                  >
                    <span
                      className="flex-shrink-0 text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing"
                      onClick={(e) => e.stopPropagation()}
                      title="드래그하여 순서 변경"
                    >
                      <GripVertical size={14} />
                    </span>
                    <StatusBadge status={task.status} />
                    <span className="text-sm text-gray-800 truncate flex-1">{task.title}</span>
                    <div className="flex -space-x-1 flex-shrink-0">
                      {task.assignees.slice(0, 2).map(({ user }) => (
                        <Avatar key={user.id} name={user.name} avatar={user.avatar} size="xs" className="ring-1 ring-white" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-x-auto">
              <div style={{ width: totalDays * colWidth + 'px', minWidth: '100%' }}>
                {/* Week headers */}
                <div className="h-8 border-b border-gray-200 flex bg-white sticky top-0 z-10">
                  {weekHeaders.map((w, i) => (
                    <div
                      key={i}
                      className="border-r border-gray-200 flex items-center px-2 text-xs font-semibold text-gray-500"
                      style={{ width: w.span * colWidth + 'px' }}
                    >
                      {w.label}
                    </div>
                  ))}
                </div>

                {/* Day headers */}
                <div className="h-8 border-b border-gray-200 flex bg-white sticky top-8 z-10">
                  {dateHeaders.map((d, i) => {
                    const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                    const isSun = d.getDay() === 0;
                    const isSat = d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={cn(
                          'border-r border-gray-100 flex items-center justify-center text-[10px] font-medium flex-shrink-0',
                          isToday ? 'bg-primary-50 text-gray-600' : isSun || isSat ? 'bg-red-50/50 text-red-400' : 'text-gray-400',
                        )}
                        style={{ width: colWidth + 'px' }}
                      >
                        {format(d, 'd')}
                      </div>
                    );
                  })}
                </div>

                {/* Task rows */}
                {ordered.map((task) => {
                  const todayOffset = differenceInDays(today, timelineStart);
                  return (
                    <div
                      key={task.id}
                      className="relative h-11 border-b border-gray-100 flex"
                    >
                      {dateHeaders.map((d, i) => {
                        const isSun = d.getDay() === 0;
                        const isSat = d.getDay() === 6;
                        return (
                          <div
                            key={i}
                            className={cn(
                              'border-r border-gray-50 flex-shrink-0 h-full',
                              isSun || isSat ? 'bg-gray-50/80' : '',
                            )}
                            style={{ width: colWidth + 'px' }}
                          />
                        );
                      })}

                      {/* Today line */}
                      {todayOffset >= 0 && todayOffset < totalDays && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary-400 z-10 pointer-events-none"
                          style={{ left: `${todayOffset * colWidth + colWidth / 2}px` }}
                        />
                      )}

                      <div className="absolute inset-0 pointer-events-none">
                        <div
                          className="absolute inset-0 pointer-events-auto"
                          style={{ transform: 'translateX(0)' }}
                        >
                          <div className="relative h-full w-full" style={{ width: totalDays * colWidth + 'px' }}>
                            <GanttBar task={task} startDate={timelineStart} totalDays={totalDays} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateTaskModal />
      <TaskDetailModal />
    </div>
  );
}
