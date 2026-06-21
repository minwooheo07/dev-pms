import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { issuesApi } from '../../api/issues';
import { projectsApi } from '../../api/projects';
import { tasksApi } from '../../api/tasks';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn, formatRelativeTime } from '../../lib/utils';
import type { IssueRisk, IssueStatus, Issue } from '../../types';

const RISK_CONFIG: Record<IssueRisk, { label: string; color: string; bg: string; dot: string }> = {
  LOW:      { label: '낮음',  color: 'text-green-700',  bg: 'bg-green-50',  dot: 'bg-green-500' },
  MEDIUM:   { label: '보통',  color: 'text-yellow-700', bg: 'bg-yellow-50', dot: 'bg-yellow-500' },
  HIGH:     { label: '높음',  color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  CRITICAL: { label: '심각',  color: 'text-red-700',    bg: 'bg-red-50',    dot: 'bg-red-500' },
};

const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; bg: string }> = {
  OPEN:      { label: '미해결',  color: 'text-red-600',    bg: 'bg-red-50' },
  IN_REVIEW: { label: '검토중',  color: 'text-blue-600',   bg: 'bg-blue-50' },
  RESOLVED:  { label: '해결됨',  color: 'text-green-600',  bg: 'bg-green-50' },
  ON_HOLD:   { label: '보류',    color: 'text-gray-600',   bg: 'bg-gray-100' },
};

const EMPTY_FORM = {
  title: '', description: '', riskLevel: 'MEDIUM' as IssueRisk,
  status: 'OPEN' as IssueStatus, assigneeId: '', taskId: '',
};

export function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'ALL'>('ALL');
  const [filterRisk, setFilterRisk] = useState<IssueRisk | 'ALL'>('ALL');

  const { data: issues, isLoading } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.getAll(projectId!),
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.getAll(projectId!),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['issues', projectId] });

  const createIssue = useMutation({
    mutationFn: () => issuesApi.create(projectId!, {
      title: form.title,
      description: form.description || undefined,
      riskLevel: form.riskLevel,
      status: form.status,
      assigneeId: form.assigneeId || undefined,
      taskId: form.taskId || undefined,
    }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast.success('이슈가 등록되었습니다.');
    },
    onError: () => toast.error('이슈 등록에 실패했습니다.'),
  });

  const updateIssue = useMutation({
    mutationFn: () => issuesApi.update(projectId!, editingIssue!.id, {
      title: form.title,
      description: form.description || undefined,
      riskLevel: form.riskLevel,
      status: form.status,
      assigneeId: form.assigneeId || null,
      taskId: form.taskId || null,
    }),
    onSuccess: () => {
      invalidate();
      setEditingIssue(null);
      setForm(EMPTY_FORM);
      toast.success('이슈가 수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteIssue = useMutation({
    mutationFn: (issueId: string) => issuesApi.delete(projectId!, issueId),
    onSuccess: () => {
      invalidate();
      toast.success('이슈가 삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  // 인라인 상태 변경
  const changeStatus = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatus }) =>
      issuesApi.update(projectId!, issueId, { status }),
    onSuccess: () => invalidate(),
  });

  const openEdit = (issue: Issue) => {
    setEditingIssue(issue);
    setForm({
      title: issue.title,
      description: issue.description ?? '',
      riskLevel: issue.riskLevel,
      status: issue.status,
      assigneeId: issue.assignee?.id ?? '',
      taskId: issue.taskId ?? '',
    });
    setShowForm(false);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingIssue(null);
    setForm(EMPTY_FORM);
  };

  const filtered = issues?.filter((i) => {
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
    if (filterRisk !== 'ALL' && i.riskLevel !== filterRisk) return false;
    return true;
  }) ?? [];

  // 요약 카운트
  const openCount = issues?.filter((i) => i.status === 'OPEN').length ?? 0;
  const criticalCount = issues?.filter((i) => i.riskLevel === 'CRITICAL' && i.status !== 'RESOLVED').length ?? 0;
  const resolvedCount = issues?.filter((i) => i.status === 'RESOLVED').length ?? 0;

  const IssueModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelForm} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">{editingIssue ? '이슈 수정' : '새 이슈 등록'}</h2>
          <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
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
              rows={4}
              placeholder="이슈 상세 내용을 입력하세요"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">연결 태스크 (칸반보드)</label>
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
          <Button variant="ghost" onClick={cancelForm}>취소</Button>
          <Button
            variant="primary"
            onClick={() => editingIssue ? updateIssue.mutate() : createIssue.mutate()}
            disabled={!form.title.trim()}
            loading={createIssue.isPending || updateIssue.isPending}
          >
            <Check size={14} /> {editingIssue ? '저장' : '등록'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '미해결 이슈', value: openCount, color: 'text-red-600' },
          { label: '심각 이슈', value: criticalCount, color: 'text-orange-600' },
          { label: '해결됨', value: resolvedCount, color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 p-4 shadow-sm">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* 상태 필터 */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {([['ALL', '전체'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilterStatus(k as any)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                  filterStatus === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-600',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {/* 위험도 필터 */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {([['ALL', '전체'], ...Object.entries(RISK_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilterRisk(k as any)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
                  filterRisk === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-600',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={() => { cancelForm(); setShowForm(true); }}>
          <Plus size={15} /> 이슈 등록
        </Button>
      </div>

      {/* 이슈 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={36} />}
          title={issues?.length ? '조건에 맞는 이슈가 없습니다' : '등록된 이슈가 없습니다'}
          description={issues?.length ? '필터를 변경해 보세요.' : '새 이슈를 등록해 위험 요소를 추적하세요.'}
        />
      ) : (
        <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">이슈</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-32">연결 태스크</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-24">위험도</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-28">해결상태</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-28">담당자</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-28">등록일</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((issue) => {
                const risk = RISK_CONFIG[issue.riskLevel];
                const status = STATUS_CONFIG[issue.status];
                return (
                  <tr key={issue.id} onClick={() => openEdit(issue)} className="hover:bg-gray-50/60 transition-colors group cursor-pointer">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                      {issue.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{issue.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {issue.task ? (
                        <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full max-w-[110px] truncate block">
                          {issue.task.title}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', risk.color, risk.bg)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', risk.dot)} />
                        {risk.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={issue.status}
                        onChange={(e) => changeStatus.mutate({ issueId: issue.id, status: e.target.value as IssueStatus })}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500',
                          status.color, status.bg,
                        )}
                      >
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      {issue.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={issue.assignee.name} avatar={issue.assignee.avatar} size="xs" />
                          <span className="text-xs text-gray-600">{issue.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400">{formatRelativeTime(issue.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (confirm(`"${issue.title}" 이슈를 삭제하시겠습니까?`)) {
                              deleteIssue.mutate(issue.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {(showForm || editingIssue) && IssueModal}
    </div>
  );
}
