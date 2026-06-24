import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Calendar, MessageSquare, Paperclip,
  Send, Trash2, Clock, Check, Pencil, Plus, Tag, ChevronRight,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { tasksApi, commentsApi, attachmentsApi, labelsApi } from '../../api/tasks';
import { openFileInNewTab } from '../../lib/download';
import { activityApi, stepsApi } from '../../api/notifications';
import { partnersApi } from '../../api/partners';
import { usersApi } from '../../api/users';
import { projectsApi } from '../../api/projects';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge } from '../ui/PriorityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { formatDate, formatRelativeTime, formatFileSize, cn, STATUS_CONFIG, PRIORITY_CONFIG } from '../../lib/utils';
import type { TaskStatus, Priority, Comment, Label } from '../../types';

const LABEL_COLORS = [
  '#e60012', '#e60012', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
];

export function TaskDetailModal() {
  const qc = useQueryClient();
  const { taskModalOpen, taskModalId, closeTaskModal, openTaskModal } = useUiStore();
  const user = useAuthStore((s) => s.user);

  const [comment, setComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!taskModalOpen) setIsEditing(false);
  }, [taskModalOpen]);
  const [editForm, setEditForm] = useState({
    title: '', part: '', description: '', priority: '', startDate: '', dueDate: '',
    assigneeIds: [] as string[], personnelIds: [] as string[], labelIds: [] as string[],
  });

  // Sub-task state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // Label creation state
  const [showLabelCreate, setShowLabelCreate] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskModalId],
    queryFn: () => tasksApi.getById(taskModalId!),
    enabled: !!taskModalId && taskModalOpen,
  });

  const { data: steps } = useQuery({
    queryKey: ['steps', task?.projectId],
    queryFn: () => stepsApi.getAll(task!.projectId),
    enabled: !!task?.projectId,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: isEditing,
  });

  const { data: allPersonnel } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: partnersApi.allPersonnel,
    enabled: isEditing,
  });

  const { data: projectLabels, refetch: refetchLabels } = useQuery({
    queryKey: ['labels', task?.projectId],
    queryFn: () => labelsApi.getAll(task!.projectId),
    enabled: !!task?.projectId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', task?.projectId],
    queryFn: () => projectsApi.getOne(task!.projectId),
    enabled: !!task?.projectId,
  });

  const startEdit = () => {
    if (!task) return;
    setEditForm({
      title: task.title,
      part: task.part ?? '',
      description: task.description ?? '',
      priority: task.priority,
      startDate: task.startDate ? task.startDate.slice(0, 10) : '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      assigneeIds: task.assignees.map((a: any) => a.user.id),
      personnelIds: task.personnel?.map((p: any) => p.personnel.id) ?? [],
      labelIds: task.labels.map((l: any) => l.label.id),
    });
    setShowLabelCreate(false);
    setIsEditing(true);
  };

  const saveEdit = () => {
    updateTask.mutate({
      title: editForm.title,
      part: editForm.part.trim() || undefined,
      description: editForm.description,
      priority: editForm.priority,
      startDate: editForm.startDate ? new Date(editForm.startDate).toISOString() : null,
      dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
      assigneeIds: editForm.assigneeIds,
      personnelIds: editForm.personnelIds,
      labelIds: editForm.labelIds,
    });
  };

  // 단계(컬럼)를 바꾸면 백엔드가 그 단계의 status를 자동 적용한다
  const handleStepChange = (stepId: string) => {
    updateTask.mutate({ stepId });
  };

  const invalidateTask = () => {
    qc.invalidateQueries({ queryKey: ['task', taskModalId] });
    qc.invalidateQueries({ queryKey: ['kanban', task!.projectId] });
    qc.invalidateQueries({ queryKey: ['gantt', task!.projectId] });
    qc.invalidateQueries({ queryKey: ['tasks', task!.projectId] });
    qc.invalidateQueries({ queryKey: ['project-stats', task!.projectId] });
  };

  const updateTask = useMutation({
    mutationFn: (data: any) => tasksApi.update(task!.projectId, taskModalId!, data),
    onSuccess: () => {
      invalidateTask();
      setIsEditing(false);
      closeTaskModal();
      toast.success('변경사항이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  // Sub-task mutations
  const createSubtask = useMutation({
    mutationFn: (title: string) =>
      tasksApi.create(task!.projectId, { title, parentId: task!.id, status: 'TODO' as any }),
    onSuccess: () => {
      invalidateTask();
      setNewSubtaskTitle('');
      setShowSubtaskInput(false);
    },
    onError: () => toast.error('서브태스크 생성에 실패했습니다.'),
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ subId, status }: { subId: string; status: TaskStatus }) =>
      tasksApi.update(task!.projectId, subId, { status }),
    onSuccess: () => invalidateTask(),
  });

  const deleteSubtask = useMutation({
    mutationFn: (subId: string) => tasksApi.delete(task!.projectId, subId),
    onSuccess: () => invalidateTask(),
  });

  // Label mutations
  const createLabel = useMutation({
    mutationFn: () => labelsApi.create(task!.projectId, newLabelName.trim(), newLabelColor),
    onSuccess: (label: Label) => {
      refetchLabels();
      setEditForm((f) => ({ ...f, labelIds: [...f.labelIds, label.id] }));
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
      setShowLabelCreate(false);
    },
    onError: () => toast.error('레이블 생성에 실패했습니다.'),
  });

  const deleteLabel = useMutation({
    mutationFn: (labelId: string) => labelsApi.delete(task!.projectId, labelId),
    onSuccess: () => {
      refetchLabels();
      qc.invalidateQueries({ queryKey: ['task', taskModalId] });
    },
  });

  const addComment = useMutation({
    mutationFn: () => commentsApi.create(taskModalId!, comment.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskModalId] });
      setComment('');
      toast.success('댓글이 작성되었습니다.');
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(taskModalId!, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskModalId] }),
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(taskModalId!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskModalId] });
      toast.success('파일이 업로드되었습니다.');
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(taskModalId!, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskModalId] }),
  });

  const isGlobalAdmin = user?.role === 'ADMIN';
  const myProjectRole = project?.members.find((m) => m.user.id === user?.id)?.role;
  const isProjectAdmin = myProjectRole === 'OWNER' || myProjectRole === 'ADMIN';
  const canEditTask = task && (isGlobalAdmin || isProjectAdmin || task.createdBy.id === user?.id);
  const canDeleteTask = canEditTask;

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(task!.projectId, taskModalId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', task!.projectId] });
      qc.invalidateQueries({ queryKey: ['project-stats', task!.projectId] });
      closeTaskModal();
      toast.success('태스크가 삭제되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  if (!taskModalOpen) return null;

  const doneCount = task?.subTasks?.filter((s: any) => s.status === 'DONE').length ?? 0;
  const totalCount = task?.subTasks?.length ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeTaskModal} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex overflow-hidden">

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {task && <StatusBadge status={task.status} />}
              {task && <PriorityBadge priority={task.priority} />}
              {task?.labels.map(({ label }: any) => (
                <span
                  key={label.id}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: label.color + '20', color: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {task && !isEditing && canEditTask && (
                <button onClick={startEdit} className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 border border-gray-200 hover:border-primary-400 px-2.5 py-1 rounded-lg transition-colors">
                  <Pencil size={12} /> 편집
                </button>
              )}
              <button onClick={closeTaskModal} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading || !task ? (
              <div className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="p-6">
                {isEditing ? (
                  /* ─── 편집 모드 ─── */
                  <div className="space-y-4 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">제목 *</label>
                      <input
                        autoFocus
                        className="w-full text-base font-semibold text-gray-600 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">업무파트</label>
                      <input
                        className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="업무파트 입력 (선택)"
                        value={editForm.part}
                        onChange={(e) => setEditForm((f) => ({ ...f, part: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">설명</label>
                      <textarea
                        className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        rows={4}
                        placeholder="태스크 설명을 입력하세요..."
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">우선순위</label>
                        <select
                          className="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          value={editForm.priority}
                          onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                        >
                          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">시작일</label>
                        <input
                          type="date"
                          className="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          value={editForm.startDate}
                          onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">종료일</label>
                        <input
                          type="date"
                          className="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          value={editForm.dueDate}
                          min={editForm.startDate || undefined}
                          onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* 레이블 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Tag size={11} /> 레이블
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowLabelCreate((v) => !v)}
                          className="text-[11px] text-gray-600 hover:text-red-600 flex items-center gap-0.5"
                        >
                          <Plus size={11} /> 새 레이블
                        </button>
                      </div>

                      {showLabelCreate && (
                        <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                          <div className="flex gap-2">
                            <input
                              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="레이블 이름"
                              value={newLabelName}
                              onChange={(e) => setNewLabelName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newLabelName.trim()) createLabel.mutate();
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => newLabelName.trim() && createLabel.mutate()}
                              disabled={!newLabelName.trim() || createLabel.isPending}
                              className="px-2.5 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-40"
                            >
                              추가
                            </button>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {LABEL_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setNewLabelColor(c)}
                                className={cn(
                                  'w-5 h-5 rounded-full transition-transform',
                                  newLabelColor === c && 'ring-2 ring-offset-1 ring-gray-400 scale-110',
                                )}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: newLabelColor + '25', color: newLabelColor }}>
                              {newLabelName || '미리보기'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {projectLabels?.map((label) => {
                          const selected = editForm.labelIds.includes(label.id);
                          return (
                            <div
                              key={label.id}
                              className="group relative flex items-center"
                            >
                              <button
                                type="button"
                                onClick={() => setEditForm((f) => ({
                                  ...f,
                                  labelIds: selected
                                    ? f.labelIds.filter((id) => id !== label.id)
                                    : [...f.labelIds, label.id],
                                }))}
                                className={cn(
                                  'flex items-center gap-1 pl-2.5 pr-6 py-0.5 rounded-full text-xs font-medium border transition-all',
                                  selected ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100',
                                )}
                                style={{
                                  backgroundColor: label.color + '20',
                                  color: label.color,
                                  borderColor: label.color + '60',
                                }}
                              >
                                {selected && <Check size={10} />}
                                {label.name}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); deleteLabel.mutate(label.id); }}
                                className="absolute right-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity rounded-full hover:bg-black/10 p-0.5"
                                style={{ color: label.color }}
                                title="레이블 삭제"
                              >
                                <X size={9} />
                              </button>
                            </div>
                          );
                        })}
                        {!projectLabels?.length && (
                          <p className="text-xs text-gray-400">레이블이 없습니다. 새 레이블을 만들어보세요.</p>
                        )}
                      </div>
                    </div>

                    {/* 담당자 */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">담당자</label>
                      <div className="flex flex-wrap gap-2">
                        {allUsers?.map((u) => {
                          const selected = editForm.assigneeIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setEditForm((f) => ({
                                ...f,
                                assigneeIds: selected
                                  ? f.assigneeIds.filter((id) => id !== u.id)
                                  : [...f.assigneeIds, u.id],
                              }))}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors',
                                selected
                                  ? 'bg-primary-50 text-primary-700 border-primary-300'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-300'
                              )}
                            >
                              <Avatar name={u.name} avatar={u.avatar} size="xs" />
                              {u.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 파트너사 인력 */}
                    {allPersonnel && allPersonnel.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">파트너사 인력</label>
                        <div className="flex flex-wrap gap-2">
                          {allPersonnel.map((p: any) => {
                            const selected = editForm.personnelIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setEditForm((f) => ({
                                  ...f,
                                  personnelIds: selected
                                    ? f.personnelIds.filter((id) => id !== p.id)
                                    : [...f.personnelIds, p.id],
                                }))}
                                className={cn(
                                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors',
                                  selected
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-300'
                                )}
                              >
                                {p.name}
                                <span className="text-[10px] opacity-70">{p.partner?.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={saveEdit}
                        disabled={!editForm.title.trim() || updateTask.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        <Check size={15} /> 저장
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        <X size={15} /> 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-gray-700 mb-3 leading-snug">{task.title}</h1>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-5 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                    )}
                  </>
                )}

                {/* ─── 서브태스크 ─── */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      서브태스크
                      {totalCount > 0 && (
                        <span className="text-[10px] font-normal bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                          {doneCount}/{totalCount}
                        </span>
                      )}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubtaskInput(true);
                        setTimeout(() => subtaskInputRef.current?.focus(), 50);
                      }}
                      className="text-[11px] text-gray-600 hover:text-red-600 flex items-center gap-0.5"
                    >
                      <Plus size={11} /> 추가
                    </button>
                  </div>

                  {/* 진행바 */}
                  {totalCount > 0 && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                      />
                    </div>
                  )}

                  {task.subTasks && task.subTasks.length > 0 && (
                    <div className="space-y-1">
                      {task.subTasks.map((sub: any) => (
                        <div key={sub.id} className="flex items-center gap-2 py-1.5 px-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                          <button
                            type="button"
                            onClick={() => toggleSubtask.mutate({
                              subId: sub.id,
                              status: sub.status === 'DONE' ? 'TODO' : 'DONE',
                            })}
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                              sub.status === 'DONE'
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-gray-300 hover:border-emerald-400',
                            )}
                          >
                            {sub.status === 'DONE' && <Check size={10} className="text-white" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openTaskModal(sub.id)}
                            className={cn(
                              'flex-1 text-sm text-left hover:text-red-600 transition-colors',
                              sub.status === 'DONE' && 'line-through text-gray-400',
                            )}
                          >
                            {sub.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSubtask.mutate(sub.id)}
                            className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-red-400 hover:text-red-600 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                          <ChevronRight size={12} className="text-gray-300 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto" />
                        </div>
                      ))}
                    </div>
                  )}

                  {showSubtaskInput && (
                    <div className="flex gap-2 mt-2">
                      <input
                        ref={subtaskInputRef}
                        className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="서브태스크 제목..."
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                            createSubtask.mutate(newSubtaskTitle.trim());
                          }
                          if (e.key === 'Escape') {
                            setShowSubtaskInput(false);
                            setNewSubtaskTitle('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => newSubtaskTitle.trim() && createSubtask.mutate(newSubtaskTitle.trim())}
                        disabled={!newSubtaskTitle.trim() || createSubtask.isPending}
                        className="px-2.5 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-40"
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowSubtaskInput(false); setNewSubtaskTitle(''); }}
                        className="px-2 py-1.5 text-gray-500 hover:text-gray-600 text-xs"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">첨부파일</h3>
                    <div className="space-y-1.5">
                      {task.attachments.map((att: any) => (
                        <div key={att.id} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 group">
                          <Paperclip size={14} className="text-gray-400 flex-shrink-0" />
                          <button
                            onClick={() => openFileInNewTab(`/attachments/${att.id}/download`)}
                            className="flex-1 text-left text-sm text-gray-600 hover:underline truncate"
                          >
                            {att.originalName}
                          </button>
                          <span className="text-xs text-gray-400">{formatFileSize(att.size)}</span>
                          <button
                            onClick={() => deleteAttachment.mutate(att.id)}
                            className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-red-400 hover:text-red-600 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div className="mb-5">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-red-600 w-fit">
                    <Paperclip size={14} />
                    파일 첨부
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadFile.mutate(e.target.files[0])}
                    />
                  </label>
                </div>

                {/* Comments */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                    댓글 {task.comments?.length ? `(${task.comments.length})` : ''}
                  </h3>
                  <div className="space-y-4">
                    {task.comments?.length ? task.comments.map((c: Comment) => (
                      <div key={c.id} className="flex gap-3 group">
                        <Avatar name={c.author.name} avatar={c.author.avatar} size="sm" className="flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-600">{c.author.name}</span>
                            <span className="text-xs text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                          </div>
                          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-600 whitespace-pre-wrap">
                            {c.content}
                          </div>
                          {c.author.id === user?.id && (
                            <button
                              onClick={() => deleteComment.mutate(c.id)}
                              className="text-[11px] text-gray-400 hover:text-red-500 mt-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-400">아직 댓글이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comment Input */}
          {task && (
            <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-white">
              <div className="flex gap-3 items-start">
                <Avatar name={user?.name ?? ''} avatar={user?.avatar} size="sm" className="flex-shrink-0 mt-1" />
                <div className="flex-1 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent overflow-hidden">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="댓글을 작성하세요..."
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && comment.trim()) {
                        e.preventDefault();
                        addComment.mutate();
                      }
                    }}
                    className="w-full px-3 py-2 text-sm focus:outline-none resize-none block"
                  />
                  <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 bg-gray-50/50">
                    <span className="text-[11px] text-gray-400">Ctrl+Enter로 전송</span>
                    <button
                      onClick={() => comment.trim() && addComment.mutate()}
                      disabled={!comment.trim() || addComment.isPending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <Send size={12} /> 전송
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 우측 사이드바 ─── */}
        {task && (
          <div className="w-56 border-l border-gray-200 bg-gray-50/50 flex flex-col overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-4">
              {/* 단계 (칸반 컬럼) — status는 단계를 따라감 */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">단계 (칸반 컬럼)</p>
                <select
                  value={task.stepId ?? ''}
                  onChange={(e) => handleStepChange(e.target.value)}
                  className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                >
                  {!task.stepId && <option value="">단계 미지정</option>}
                  {steps?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {STATUS_CONFIG[s.status as TaskStatus]?.label ?? s.status}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  현재 상태: {STATUS_CONFIG[task.status as TaskStatus]?.label ?? task.status} (단계에 따라 자동 설정)
                </p>
              </div>

              {/* Priority */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">우선순위</p>
                <select
                  value={task.priority}
                  onChange={(e) => updateTask.mutate({ priority: e.target.value })}
                  className="w-full text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* 시작일 */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">시작일</p>
                <p className="text-xs text-gray-600">{task.startDate ? formatDate(task.startDate) : <span className="text-gray-300">-</span>}</p>
              </div>

              {/* 종료일 */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">종료일</p>
                <p className="text-xs text-gray-600">{task.dueDate ? formatDate(task.dueDate) : <span className="text-gray-300">-</span>}</p>
              </div>

              {/* Labels (read) */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">레이블</p>
                {task.labels.length === 0 ? (
                  <p className="text-xs text-gray-400">없음</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map(({ label }: any) => (
                      <span
                        key={label.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: label.color + '20', color: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignees */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">담당자</p>
                {task.assignees.length === 0 ? (
                  <p className="text-xs text-gray-400">없음</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {task.assignees.map(({ user: u }: any) => (
                      <div key={u.id} className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={u.name} avatar={u.avatar} size="xs" />
                        <span className="text-xs text-gray-600 truncate">{u.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Partner Personnel */}
              {task.personnel && task.personnel.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">파트너사 인력</p>
                  <div className="space-y-1.5">
                    {task.personnel.map(({ personnel: p }: any) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-semibold text-emerald-700">{p.name[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-600">{p.name}</span>
                          <span className="text-[10px] text-gray-400 ml-1">{p.partner?.name}{p.position ? ` · ${p.position}` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* Meta */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-[11px] text-gray-400">
                  생성: {formatRelativeTime(task.createdAt)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Avatar name={task.createdBy.name} avatar={task.createdBy.avatar} size="xs" />
                  <p className="text-[11px] text-gray-400">{task.createdBy.name}</p>
                </div>
              </div>

              {/* Delete */}
              {canDeleteTask && (
                <div className="pt-2 border-t border-gray-200">
                  <button
                    onClick={() => {
                      if (confirm(`"${task.title}" 태스크를 삭제하시겠습니까?`)) {
                        deleteTask.mutate();
                      }
                    }}
                    disabled={deleteTask.isPending}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 py-1.5 px-2 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} /> 태스크 삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
