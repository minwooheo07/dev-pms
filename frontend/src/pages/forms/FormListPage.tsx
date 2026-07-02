import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList, Trash2, Pencil, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import { formsApi } from '../../api/forms';
import { projectsApi } from '../../api/projects';
import { useAuthStore } from '../../store/auth.store';
import { formatDate } from '../../lib/utils';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

export function FormListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  const projectId = searchParams.get('project') ?? projects?.[0]?.id ?? null;

  const { data: forms, isLoading } = useQuery({
    queryKey: ['forms', projectId],
    queryFn: () => formsApi.list(projectId!),
    enabled: !!projectId,
  });

  const createForm = useMutation({
    mutationFn: (name: string) => formsApi.create(projectId!, name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['forms', projectId] });
      setCreating(false);
      setNewName('');
      navigate(`/projects/${projectId}/forms/${data.id}/builder`);
    },
    onError: () => toast.error('양식 생성에 실패했습니다.'),
  });

  const deleteForm = useMutation({
    mutationFn: (id: string) => formsApi.remove(projectId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forms', projectId] });
      toast.success('양식이 삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const handleCreate = () => {
    const name = newName.trim() || '새 양식';
    createForm.mutate(name);
  };

  const selectedProject = projects?.find((p: any) => p.id === projectId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-700">양식</h1>
            <p className="text-sm text-gray-400 mt-0.5">보고서·신청서 양식을 직접 만들고 관리하세요</p>
          </div>
          {projectId && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={15} /> 새 양식
            </button>
          )}
        </div>

        {projects && projects.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {projects.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSearchParams({ project: p.id })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  projectId === p.id
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                }`}
                style={projectId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: projectId === p.id ? 'rgba(255,255,255,0.7)' : p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {creating && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-primary-50 border border-gray-200 rounded-xl">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
              placeholder="양식 이름 (Enter로 생성)"
              className="flex-1 text-sm bg-transparent outline-none placeholder-primary-300 text-gray-900"
            />
            <button onClick={handleCreate} className="text-xs font-medium text-gray-600 hover:text-red-600 px-2">생성</button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">취소</button>
          </div>
        )}

        {!projectId ? (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title="프로젝트를 선택하세요"
            description="상단에서 프로젝트를 선택하면 양식 목록을 볼 수 있습니다."
          />
        ) : isLoading ? (
          <LoadingSpinner />
        ) : !forms?.length ? (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title={`${selectedProject?.name ?? ''} 양식이 없습니다`}
            description="새 양식을 만들어 원하는 항목으로 커스터마이징해보세요."
            action={
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={15} /> 새 양식 만들기
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {forms.map((form: any) => (
              <div
                key={form.id}
                className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/projects/${projectId}/forms/${form.id}/submissions`)}
              >
                <div className="h-20 bg-gradient-to-br from-indigo-50 via-violet-50 to-white flex items-center justify-center">
                  <ClipboardList size={24} className="text-indigo-300" />
                </div>

                <div className="px-3 py-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{form.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <ListChecks size={11} /> 제출 {form._count?.submissions ?? 0}건 · {formatDate(form.updatedAt)}
                  </div>
                </div>

                {(me?.role === 'ADMIN' || form.createdBy?.id === me?.id) && (
                  <div
                    className="absolute top-2 right-2 flex gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => navigate(`/projects/${projectId}/forms/${form.id}/builder`)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-primary-600 transition-colors"
                      title="양식 편집"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`"${form.name}"을 삭제하시겠습니까?`)) deleteForm.mutate(form.id); }}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow border border-gray-200 text-gray-500 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
