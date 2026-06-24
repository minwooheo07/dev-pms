import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { tasksApi } from '../../api/tasks';
import { projectsApi } from '../../api/projects';
import { partnersApi } from '../../api/partners';
import { usersApi } from '../../api/users';
import { useUiStore } from '../../store/ui.store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';
import type { Priority } from '../../types';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'URGENT', label: '긴급', color: 'text-red-600' },
  { value: 'HIGH', label: '높음', color: 'text-orange-600' },
  { value: 'MEDIUM', label: '중간', color: 'text-yellow-600' },
  { value: 'LOW', label: '낮음', color: 'text-gray-500' },
];

export function CreateTaskModal() {
  const qc = useQueryClient();
  const { createTaskProjectId, createTaskStepId, closeCreateTask } = useUiStore();
  const open = !!createTaskProjectId;

  const [title, setTitle] = useState('');
  const [part, setPart] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [personnelIds, setPersonnelIds] = useState<string[]>([]);

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: open,
  });

  // 파트너사 인력 (전체)
  const { data: allPersonnel } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: partnersApi.allPersonnel,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: (data: any) => tasksApi.create(createTaskProjectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', createTaskProjectId] });
      qc.invalidateQueries({ queryKey: ['tasks', createTaskProjectId] });
      toast.success('태스크가 생성되었습니다.');
      handleClose();
    },
    onError: () => toast.error('태스크 생성에 실패했습니다.'),
  });

  const handleClose = () => {
    setTitle('');
    setPart('');
    setDescription('');
    setPriority('MEDIUM');
    setStartDate('');
    setDueDate('');
    setAssigneeIds([]);
    setPersonnelIds([]);
    closeCreateTask();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({
      title: title.trim(),
      part: part.trim() || undefined,
      description: description.trim() || undefined,
      priority,
      stepId: createTaskStepId ?? undefined,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      assigneeIds,
      personnelIds,
    });
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">새 태스크</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <Input
            label="제목 *"
            placeholder="태스크 제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
          <Input
            label="업무파트"
            placeholder="업무파트 입력 (선택)"
            value={part}
            onChange={(e) => setPart(e.target.value)}
          />
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">설명</label>
            <textarea
              placeholder="태스크 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">우선순위</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="시작일"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="마감일"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {allUsers && allUsers.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">담당자</label>
              <div className="flex flex-wrap gap-1.5">
                {allUsers.map((u: any) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setAssigneeIds((prev) =>
                      prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                    )}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      assigneeIds.includes(u.id)
                        ? 'bg-primary-50 border-gray-300 text-gray-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allPersonnel && allPersonnel.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">파트너사 인력</label>
              <div className="flex flex-wrap gap-1.5">
                {allPersonnel.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonnelIds((prev) =>
                      prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                    )}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                      personnelIds.includes(p.id)
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                    title={p.partner?.name}
                  >
                    {p.name}
                    <span className="text-gray-400 ml-1">· {p.partner?.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={handleClose}>취소</Button>
            <Button type="submit" variant="primary" loading={create.isPending}>생성</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
