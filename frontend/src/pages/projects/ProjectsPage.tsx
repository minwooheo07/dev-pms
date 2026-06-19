import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FolderKanban, MoreHorizontal, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '../../api/projects';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PROJECT_STATUS_CONFIG, formatDate, cn } from '../../lib/utils';
import type { ProjectStatus } from '../../types';

const STATUS_OPTIONS: { value: ProjectStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'ON_HOLD', label: '보류' },
  { value: 'ARCHIVED', label: '보관됨' },
];

const PROJECT_COLORS = [
  '#e60012', '#e60012', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#0ea5e9',
];

export function ProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#e60012', startDate: '', endDate: '', openDate: '' });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  const createProject = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      setForm({ name: '', description: '', color: '#e60012', startDate: '', endDate: '', openDate: '' });
      toast.success('프로젝트가 생성되었습니다.');
    },
    onError: () => toast.error('프로젝트 생성에 실패했습니다.'),
  });

  const deleteProject = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('프로젝트가 삭제되었습니다.');
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.');
    },
  });

  const filtered = projects?.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  }) ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-700">프로젝트</h1>
          <p className="text-sm text-gray-500 mt-0.5">팀의 모든 프로젝트를 관리하세요.</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          새 프로젝트
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="프로젝트 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value as any)}
              className={cn(
                'px-3 py-1 text-xs rounded-md font-medium transition-colors',
                statusFilter === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-600',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon={<FolderKanban size={48} />}
          title="프로젝트가 없습니다"
          description="새 프로젝트를 만들어 팀과 협업을 시작하세요."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> 첫 프로젝트 만들기
            </Button>
          }
        />
      ) : (
        <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">프로젝트</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">상태</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">멤버</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">태스크</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">마감일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => {
                const cfg = PROJECT_STATUS_CONFIG[p.status];
                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-5 py-3.5">
                      <Link to={`/projects/${p.id}`} className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: p.color + '20' }}
                        >
                          {p.icon ?? '📁'}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 hover:text-red-600 transition-colors">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex -space-x-1">
                        {p.members.slice(0, 4).map((m) => (
                          <Avatar key={m.id} name={m.user.name} avatar={m.user.avatar} size="xs" className="ring-2 ring-white" />
                        ))}
                        {p.members.length > 4 && (
                          <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-medium flex items-center justify-center ring-2 ring-white">
                            +{p.members.length - 4}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600">{p._count.tasks}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-500">
                        {p.endDate ? formatDate(p.endDate) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (confirm('프로젝트를 삭제하시겠습니까?')) {
                              deleteProject.mutate(p.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
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

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="새 프로젝트 만들기">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            createProject.mutate({
              name: form.name,
              description: form.description || undefined,
              color: form.color,
              startDate: form.startDate || undefined,
              endDate: form.endDate || undefined,
              openDate: form.openDate || undefined,
            } as any);
          }}
          className="p-6 space-y-4"
        >
          <Input
            label="프로젝트 이름 *"
            placeholder="프로젝트 명칭을 입력하세요."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">설명</label>
            <textarea
              placeholder="프로젝트 설명을 입력하세요."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label="시작일"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Input
                label="종료일"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <Input
            label="오픈예정일"
            type="date"
            value={form.openDate}
            onChange={(e) => setForm({ ...form, openDate: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">색상</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform',
                    form.color === c && 'ring-2 ring-offset-2 ring-gray-400 scale-110',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button type="submit" variant="primary" loading={createProject.isPending}>
              프로젝트 만들기
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
