import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, AlertTriangle, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { issuesApi } from '../../api/issues';
import { projectsApi } from '../../api/projects';
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
  status: 'OPEN' as IssueStatus, assigneeId: '',
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['issues', projectId] });

  const createIssue = useMutation({
    mutationFn: () => issuesApi.create(projectId!, {
      title: form.title,
      description: form.description || undefined,
      riskLevel: form.riskLevel,
      status: form.status,
      assigneeId: form.assigneeId || undefined,
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

  const IssueForm = (
    <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {editingIssue ? '이슈 수정' : '새 이슈 등록'}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
          <input
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="이슈 제목을 입력하세요"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">설명</label>
          <textarea
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            placeholder="이슈 상세 내용을 입력하세요"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">위험도</label>
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.riskLevel}
              onChange={(e) => setForm((f) => ({ ...f, riskLevel: e.target.value as IssueRisk }))}
            >
              {Object.entries(RISK_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">해결상태</label>
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IssueStatus }))}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">담당자</label>
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        <div className="flex gap-2 pt-1">
          <Button
            variant="primary"
            onClick={() => editingIssue ? updateIssue.mutate() : createIssue.mutate()}
            disabled={!form.title.trim()}
            loading={createIssue.isPending || updateIssue.isPending}
          >
            <Check size={14} /> {editingIssue ? '저장' : '등록'}
          </Button>
          <Button variant="secondary" onClick={cancelForm}>
            <X size={14} /> 취소
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto overflow-y-auto h-full">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '미해결 이슈', value: openCount, color: 'text-red-600' },
          { label: '심각 이슈', value: criticalCount, color: 'text-orange-600' },
          { label: '해결됨', value: resolvedCount, color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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
                  filterStatus === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
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
                  filterRisk === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
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

      {/* 등록/수정 폼 */}
      {(showForm || editingIssue) && IssueForm}

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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">이슈</th>
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
                  <tr key={issue.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                      {issue.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{issue.description}</p>
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
                          'text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500',
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
                          <span className="text-xs text-gray-700">{issue.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400">{formatRelativeTime(issue.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => openEdit(issue)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${issue.title}" 이슈를 삭제하시겠습니까?`)) {
                              deleteIssue.mutate(issue.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
    </div>
  );
}
