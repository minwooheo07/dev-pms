import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { issuesApi } from '../../api/issues';
import { projectsApi } from '../../api/projects';
import { tasksApi } from '../../api/tasks';
import { Button } from '../ui/Button';
import type { IssueRisk, IssueStatus } from '../../types';

export interface IssueEditTarget {
  id: string;
  title: string;
  description?: string;
  riskLevel: IssueRisk;
  status: IssueStatus;
  taskId?: string | null;
  assignee?: { id: string; name: string; avatar?: string } | null;
}

const RISK_CONFIG: Record<IssueRisk, { label: string }> = {
  LOW:      { label: '낮음' },
  MEDIUM:   { label: '보통' },
  HIGH:     { label: '높음' },
  CRITICAL: { label: '심각' },
};

const STATUS_CONFIG: Record<IssueStatus, { label: string }> = {
  OPEN:      { label: '미해결' },
  IN_REVIEW: { label: '검토중' },
  RESOLVED:  { label: '해결됨' },
  ON_HOLD:   { label: '보류' },
};

interface Props {
  projectId: string;
  issue: IssueEditTarget;
  onClose: () => void;
}

export function IssueEditModal({ projectId, issue, onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: issue.title,
    description: issue.description ?? '',
    riskLevel: issue.riskLevel,
    status: issue.status,
    assigneeId: issue.assignee?.id ?? '',
    taskId: issue.taskId ?? '',
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId),
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.getAll(projectId),
  });

  const updateIssue = useMutation({
    mutationFn: () => issuesApi.update(projectId, issue.id, {
      title: form.title,
      description: form.description || undefined,
      riskLevel: form.riskLevel,
      status: form.status,
      assigneeId: form.assigneeId || null,
      taskId: form.taskId || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['gantt', projectId] });
      toast.success('이슈가 수정되었습니다.');
      onClose();
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">이슈 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
            <input
              autoFocus
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="이슈 제목을 입력하세요"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">설명</label>
            <textarea
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              placeholder="이슈 상세 내용을 입력하세요"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">연결 태스크</label>
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.taskId}
              onChange={(e) => setForm((f) => ({ ...f, taskId: e.target.value }))}
            >
              <option value="">없음</option>
              {tasks?.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">위험도</label>
              <select
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.riskLevel}
                onChange={(e) => setForm((f) => ({ ...f, riskLevel: e.target.value as IssueRisk }))}
              >
                {Object.entries(RISK_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">해결상태</label>
              <select
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IssueStatus }))}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자</label>
              <select
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.assigneeId}
                onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
              >
                <option value="">없음</option>
                {project?.members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            onClick={() => updateIssue.mutate()}
            disabled={!form.title.trim()}
            loading={updateIssue.isPending}
          >
            <Check size={14} /> 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
